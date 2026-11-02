-- 001 및 기존 추첨/관리 기록은 보존한다. 전체 과거 수집·일일 예산은 더 이상 사용하지 않는다.
-- 전환 당시 저장된 최대 회차 다음부터 정기 보충한다. 빈 DB는 첫 최신 저장 때 경계를 고정한다.
ALTER TABLE lotto.sync_state ADD COLUMN regular_from_round integer CHECK (regular_from_round > 0);
UPDATE lotto.sync_state SET regular_from_round=(SELECT max(round)+1 FROM lotto.draws);

CREATE OR REPLACE FUNCTION lotto.acquire_sync(p_owner uuid, p_kind text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = pg_catalog, lotto AS $$
DECLARE s lotto.sync_state;
BEGIN
  IF p_kind NOT IN ('daily','manual') THEN RAISE EXCEPTION 'invalid-kind'; END IF;
  SELECT * INTO s FROM lotto.sync_state WHERE singleton FOR UPDATE;
  IF s.lease_until > clock_timestamp() OR s.next_source_at > clock_timestamp() THEN RETURN NULL; END IF;
  UPDATE lotto.sync_runs SET status='failed',finished_at=clock_timestamp(),error_code='lease-lost' WHERE status='running';
  UPDATE lotto.sync_state SET lease_owner=p_owner,lease_until=clock_timestamp()+interval '60 seconds',
    fencing_token=fencing_token+1,updated_at=clock_timestamp() WHERE singleton RETURNING * INTO s;
  INSERT INTO lotto.sync_runs(id,kind,status,fencing_token) VALUES (p_owner,p_kind,'running',s.fencing_token);
  DELETE FROM lotto.sync_runs WHERE finished_at < clock_timestamp()-interval '30 days';
  RETURN jsonb_build_object('token',s.fencing_token);
END $$;

CREATE OR REPLACE FUNCTION lotto.sync_action(p_owner uuid,p_token bigint,p_action text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = pg_catalog, lotto AS $$
DECLARE s lotto.sync_state; r integer; n integer; old_hash text; dr jsonb; v_at timestamptz;
  delay interval; result jsonb;
BEGIN
  SELECT * INTO s FROM lotto.sync_state WHERE singleton FOR UPDATE;
  IF s.lease_owner IS DISTINCT FROM p_owner OR s.fencing_token <> p_token OR
     s.lease_until <= clock_timestamp() THEN RAISE EXCEPTION 'lease-lost'; END IF;
  IF p_action='plan' THEN
    SELECT jsonb_build_object('latest',s.latest_confirmed_round,'latestCheckedAt',s.latest_checked_at,
      'latestRetryAt',s.next_latest_at,
      'missing',COALESCE((SELECT jsonb_agg(m.round ORDER BY m.round) FROM
        (SELECT g AS round FROM generate_series(s.regular_from_round,COALESCE(s.latest_confirmed_round,0)) g
         WHERE NOT EXISTS(SELECT 1 FROM lotto.draws x WHERE x.round=g)
         ORDER BY g LIMIT 2) m),'[]'::jsonb),
      'pending',COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM
        (SELECT round,latest FROM lotto.sync_cache_pending ORDER BY created_at,round LIMIT 3) c),'[]'::jsonb)) INTO result;
    RETURN result;
  ELSIF p_action='reserve' THEN
    IF (p->>'round') IS NULL AND s.next_latest_at > clock_timestamp() THEN
      RETURN jsonb_build_object('allowed',false);
    END IF;
    IF s.next_source_at > clock_timestamp() OR s.last_source_at > clock_timestamp()-interval '1 second' THEN RAISE EXCEPTION 'request-budget'; END IF;
    IF (SELECT requests FROM lotto.sync_runs WHERE id=p_owner)>=3 THEN RAISE EXCEPTION 'request-budget'; END IF;
    UPDATE lotto.sync_runs SET requests=requests+1 WHERE id=p_owner;
    UPDATE lotto.sync_state SET last_source_at=clock_timestamp() WHERE singleton;
  ELSIF p_action='save' THEN
    dr:=p->'draw'; r:=(dr->>'episode')::integer; v_at:=(p->>'verifiedAt')::timestamptz;
    IF (p->>'latest')::boolean AND s.latest_confirmed_round > r THEN RAISE EXCEPTION 'latest-regression'; END IF;
    IF v_at > clock_timestamp()+interval '1 minute' OR v_at < clock_timestamp()-interval '1 day' THEN RAISE EXCEPTION 'invalid-verified-at'; END IF;
    SELECT content_hash INTO old_hash FROM lotto.draws WHERE round=r;
    INSERT INTO lotto.draws(round,draw_date,number_1,number_2,number_3,number_4,number_5,number_6,bonus,source_url,verified_at,content_hash)
    VALUES(r,(dr->>'drawDate')::date,(dr->'numbers'->>0)::smallint,(dr->'numbers'->>1)::smallint,
      (dr->'numbers'->>2)::smallint,(dr->'numbers'->>3)::smallint,(dr->'numbers'->>4)::smallint,(dr->'numbers'->>5)::smallint,
      (dr->>'bonus')::smallint,p->>'sourceUrl',v_at,p->>'hash')
    ON CONFLICT(round) DO UPDATE SET draw_date=EXCLUDED.draw_date,number_1=EXCLUDED.number_1,number_2=EXCLUDED.number_2,
      number_3=EXCLUDED.number_3,number_4=EXCLUDED.number_4,number_5=EXCLUDED.number_5,number_6=EXCLUDED.number_6,
      bonus=EXCLUDED.bonus,source_url=EXCLUDED.source_url,verified_at=EXCLUDED.verified_at,
      content_hash=EXCLUDED.content_hash,updated_at=CASE WHEN lotto.draws.content_hash<>EXCLUDED.content_hash THEN clock_timestamp() ELSE lotto.draws.updated_at END;
    IF (p->>'latest')::boolean THEN
      UPDATE lotto.sync_state SET latest_confirmed_round=r,latest_checked_at=v_at,regular_from_round=COALESCE(regular_from_round,r+1),latest_failures=0,next_latest_at=NULL WHERE singleton;
    END IF;
    UPDATE lotto.sync_state SET updated_at=clock_timestamp() WHERE singleton;
    INSERT INTO lotto.sync_cache_pending(round,latest) VALUES(r,(p->>'latest')::boolean)
      ON CONFLICT(round) DO UPDATE SET latest=lotto.sync_cache_pending.latest OR EXCLUDED.latest;
    UPDATE lotto.sync_runs SET succeeded=succeeded+1,cursor_from=LEAST(cursor_from,r),cursor_to=GREATEST(cursor_to,r) WHERE id=p_owner;
    RETURN jsonb_build_object('changed',old_hash IS DISTINCT FROM p->>'hash');
  ELSIF p_action='failure' THEN
    r:=(p->>'round')::integer;
    -- 개별 실패는 큐에 넣지 않고 새 회차의 미저장 판정으로 다음 실행에서 재시도한다.
    n:=CASE WHEN r IS NULL THEN s.latest_failures+1 ELSE 1 END;
    delay:=make_interval(days=>CASE WHEN n=1 THEN 1 WHEN n=2 THEN 2 WHEN n=3 THEN 4 ELSE 7 END);
    IF r IS NULL THEN
      UPDATE lotto.sync_state SET latest_failures=n,next_latest_at=clock_timestamp()+delay WHERE singleton;
    END IF;
    IF p->>'code'='blocked' THEN
      UPDATE lotto.sync_state SET next_source_at=GREATEST(clock_timestamp()+delay,
        COALESCE((p->>'retryAt')::timestamptz,clock_timestamp())) WHERE singleton;
    END IF;
    UPDATE lotto.sync_runs SET failed=failed+1,error_code=p->>'code' WHERE id=p_owner;
  ELSIF p_action='invalidated' THEN
    DELETE FROM lotto.sync_cache_pending WHERE round=(p->>'round')::integer;
  ELSIF p_action='finish' THEN
    UPDATE lotto.sync_runs SET status=p->>'status',error_code=COALESCE(p->>'code',error_code),finished_at=clock_timestamp() WHERE id=p_owner;
    UPDATE lotto.sync_state SET lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE singleton;
  ELSE RAISE EXCEPTION 'invalid-action'; END IF;
  RETURN '{}'::jsonb;
END $$;
REVOKE ALL ON FUNCTION lotto.acquire_sync(uuid,text), lotto.sync_action(uuid,bigint,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lotto.acquire_sync(uuid,text), lotto.sync_action(uuid,bigint,text,jsonb) TO lotto_writer;
