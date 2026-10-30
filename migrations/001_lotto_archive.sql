-- 관리 명령 전용. migrate-archive.ts가 checksum과 advisory lock을 관리한다.
CREATE SCHEMA lotto;
REVOKE ALL ON SCHEMA lotto FROM PUBLIC;
CREATE ROLE lotto_reader NOLOGIN;
CREATE ROLE lotto_writer NOLOGIN;
GRANT USAGE ON SCHEMA lotto TO lotto_reader, lotto_writer;

CREATE TABLE lotto.draws (
  round integer PRIMARY KEY CHECK (round > 0),
  draw_date date NOT NULL CHECK (isfinite(draw_date) AND draw_date >= DATE '2002-12-07'),
  number_1 smallint NOT NULL, number_2 smallint NOT NULL,
  number_3 smallint NOT NULL, number_4 smallint NOT NULL,
  number_5 smallint NOT NULL, number_6 smallint NOT NULL,
  bonus smallint NOT NULL CHECK (bonus BETWEEN 1 AND 45),
  source_url text NOT NULL CHECK (source_url LIKE 'https://www.dhlottery.co.kr/%'),
  verified_at timestamptz NOT NULL CHECK (isfinite(verified_at)),
  content_hash char(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (1 <= number_1 AND number_1 < number_2 AND number_2 < number_3 AND
    number_3 < number_4 AND number_4 < number_5 AND number_5 < number_6 AND number_6 <= 45),
  CHECK (bonus NOT IN (number_1,number_2,number_3,number_4,number_5,number_6))
);
CREATE TABLE lotto.sync_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  latest_confirmed_round integer REFERENCES lotto.draws(round),
  latest_checked_at timestamptz,
  backfill_next_round integer NOT NULL DEFAULT 1 CHECK (backfill_next_round > 0),
  backfill_upper_round integer,
  lease_owner uuid, lease_until timestamptz,
  fencing_token bigint NOT NULL DEFAULT 0,
  next_source_at timestamptz, next_latest_at timestamptz, last_source_at timestamptz,
  latest_failures integer NOT NULL DEFAULT 0,
  usage_percent numeric CHECK (usage_percent BETWEEN 0 AND 100),
  usage_checked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO lotto.sync_state(singleton) VALUES (true);
CREATE VIEW lotto.latest AS SELECT latest_confirmed_round, latest_checked_at FROM lotto.sync_state;
CREATE TABLE lotto.sync_runs (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('daily','manual','backfill')),
  status text NOT NULL CHECK (status IN ('running','success','partial','failed','skipped')),
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  cursor_from integer, cursor_to integer,
  requests integer NOT NULL DEFAULT 0, succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  error_code text CHECK (error_code IN ('timeout','network','blocked','invalid','empty','request-budget','run-budget','usage-limit','usage-unknown','lease-lost','cache','storage','latest-regression','schedule','deadline')),
  fencing_token bigint NOT NULL
);
CREATE INDEX sync_runs_started ON lotto.sync_runs(started_at);
CREATE TABLE lotto.sync_failures (
  round integer PRIMARY KEY CHECK (round > 0), attempts integer NOT NULL CHECK (attempts > 0),
  next_retry_at timestamptz NOT NULL,
  error_code text NOT NULL CHECK (error_code IN ('timeout','network','blocked','invalid','empty','cache','schedule','deadline')),
  first_failed_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sync_failures_due ON lotto.sync_failures(next_retry_at, round);
CREATE TABLE lotto.sync_budget_daily (
  day date PRIMARY KEY,
  source_requests integer NOT NULL DEFAULT 0 CHECK (source_requests BETWEEN 0 AND 100),
  run_attempts integer NOT NULL DEFAULT 0 CHECK (run_attempts BETWEEN 0 AND 40),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 캐시 무효화 실패를 다음 실행에서 최대 3회차씩 재처리한다.
CREATE TABLE lotto.sync_cache_pending (
  round integer PRIMARY KEY REFERENCES lotto.draws(round),
  latest boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON lotto.draws, lotto.latest TO lotto_reader;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA lotto TO lotto_writer;
REVOKE ALL ON lotto.latest FROM lotto_writer;
GRANT SELECT ON lotto.latest TO lotto_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA lotto REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE FUNCTION lotto.acquire_sync(p_owner uuid, p_kind text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = pg_catalog, lotto AS $$
DECLARE s lotto.sync_state; b lotto.sync_budget_daily; d date := (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  IF p_kind NOT IN ('daily','manual','backfill') THEN RAISE EXCEPTION 'invalid-kind'; END IF;
  SELECT * INTO s FROM lotto.sync_state WHERE singleton FOR UPDATE;
  IF s.lease_until > clock_timestamp() OR s.next_source_at > clock_timestamp() THEN RETURN NULL; END IF;
  INSERT INTO lotto.sync_budget_daily(day) VALUES (d) ON CONFLICT DO NOTHING;
  SELECT * INTO b FROM lotto.sync_budget_daily WHERE day=d FOR UPDATE;
  IF b.run_attempts >= 40 THEN RETURN NULL; END IF;
  UPDATE lotto.sync_budget_daily SET run_attempts=run_attempts+1, updated_at=clock_timestamp() WHERE day=d;
  UPDATE lotto.sync_runs SET status='failed',finished_at=clock_timestamp(),error_code='lease-lost' WHERE status='running';
  UPDATE lotto.sync_state SET lease_owner=p_owner,lease_until=clock_timestamp()+interval '60 seconds',
    fencing_token=fencing_token+1,updated_at=clock_timestamp() WHERE singleton RETURNING * INTO s;
  INSERT INTO lotto.sync_runs(id,kind,status,fencing_token) VALUES (p_owner,p_kind,'running',s.fencing_token);
  DELETE FROM lotto.sync_runs WHERE finished_at < clock_timestamp()-interval '30 days';
  DELETE FROM lotto.sync_budget_daily WHERE day < d-90;
  RETURN jsonb_build_object('token',s.fencing_token);
END $$;

CREATE FUNCTION lotto.sync_action(p_owner uuid,p_token bigint,p_action text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = pg_catalog, lotto AS $$
DECLARE s lotto.sync_state; r integer; n integer; old_hash text; dr jsonb; v_at timestamptz;
  d date := (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
  delay interval; result jsonb; usage numeric;
BEGIN
  SELECT * INTO s FROM lotto.sync_state WHERE singleton FOR UPDATE;
  IF s.lease_owner IS DISTINCT FROM p_owner OR s.fencing_token <> p_token OR
     s.lease_until <= clock_timestamp() THEN RAISE EXCEPTION 'lease-lost'; END IF;
  usage := CASE WHEN s.usage_checked_at > clock_timestamp()-interval '1 day' THEN s.usage_percent ELSE NULL END;
  IF p_action='plan' THEN
    SELECT jsonb_build_object('latest',s.latest_confirmed_round,'latestCheckedAt',s.latest_checked_at,
      'latestRetryAt',s.next_latest_at,'usage',usage,
      'failures',COALESCE((SELECT jsonb_agg(f.round ORDER BY f.next_retry_at,f.round) FROM
        (SELECT round,next_retry_at FROM lotto.sync_failures WHERE next_retry_at<=clock_timestamp() ORDER BY next_retry_at,round LIMIT 3) f),'[]'::jsonb),
      'missing',COALESCE((SELECT jsonb_agg(m.round ORDER BY m.round) FROM
        (SELECT g AS round FROM generate_series(s.backfill_next_round,COALESCE(s.latest_confirmed_round,0)) g
         WHERE NOT EXISTS(SELECT 1 FROM lotto.draws x WHERE x.round=g)
         AND NOT EXISTS(SELECT 1 FROM lotto.sync_failures f WHERE f.round=g) ORDER BY g LIMIT 3) m),'[]'::jsonb),
      'pending',COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM
        (SELECT round,latest FROM lotto.sync_cache_pending ORDER BY created_at,round LIMIT 3) c),'[]'::jsonb)) INTO result;
    RETURN result;
  ELSIF p_action='reserve' THEN
    IF usage >= 95 THEN RAISE EXCEPTION 'usage-limit'; END IF;
    IF ((p->>'round') IS NULL AND s.next_latest_at > clock_timestamp()) OR
      EXISTS(SELECT 1 FROM lotto.sync_failures WHERE round=(p->>'round')::integer AND next_retry_at>clock_timestamp()) THEN
      RETURN jsonb_build_object('allowed',false);
    END IF;
    IF s.next_source_at > clock_timestamp() OR s.last_source_at > clock_timestamp()-interval '1 second' THEN RAISE EXCEPTION 'request-budget'; END IF;
    IF (SELECT requests FROM lotto.sync_runs WHERE id=p_owner)>=3 THEN RAISE EXCEPTION 'request-budget'; END IF;
    INSERT INTO lotto.sync_budget_daily(day) VALUES(d) ON CONFLICT DO NOTHING;
    UPDATE lotto.sync_budget_daily SET source_requests=source_requests+1, updated_at=clock_timestamp()
      WHERE day=d AND source_requests<100;
    IF NOT FOUND THEN RAISE EXCEPTION 'request-budget'; END IF;
    UPDATE lotto.sync_runs SET requests=requests+1 WHERE id=p_owner;
    UPDATE lotto.sync_state SET last_source_at=clock_timestamp() WHERE singleton;
  ELSIF p_action='save' THEN
    dr:=p->'draw'; r:=(dr->>'episode')::integer; v_at:=(p->>'verifiedAt')::timestamptz;
    IF usage >=95 THEN RAISE EXCEPTION 'usage-limit'; END IF;
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
      UPDATE lotto.sync_state SET latest_confirmed_round=r,latest_checked_at=v_at,backfill_upper_round=GREATEST(COALESCE(backfill_upper_round,0),r),latest_failures=0,next_latest_at=NULL WHERE singleton;
    END IF;
    DELETE FROM lotto.sync_failures WHERE round=r;
    UPDATE lotto.sync_state SET backfill_next_round=COALESCE(
      (SELECT g FROM generate_series(backfill_next_round,COALESCE(latest_confirmed_round,0)) g
       WHERE NOT EXISTS(SELECT 1 FROM lotto.draws x WHERE x.round=g) ORDER BY g LIMIT 1),
      COALESCE(latest_confirmed_round,0)+1),updated_at=clock_timestamp() WHERE singleton;
    INSERT INTO lotto.sync_cache_pending(round,latest) VALUES(r,(p->>'latest')::boolean)
      ON CONFLICT(round) DO UPDATE SET latest=lotto.sync_cache_pending.latest OR EXCLUDED.latest;
    UPDATE lotto.sync_runs SET succeeded=succeeded+1,cursor_from=LEAST(cursor_from,r),cursor_to=GREATEST(cursor_to,r) WHERE id=p_owner;
    RETURN jsonb_build_object('changed',old_hash IS DISTINCT FROM p->>'hash');
  ELSIF p_action='failure' THEN
    r:=(p->>'round')::integer;
    IF r IS NOT NULL THEN
      SELECT attempts INTO n FROM lotto.sync_failures WHERE round=r;
    ELSE n:=s.latest_failures; END IF;
    n:=COALESCE(n,0)+1;
    delay:=make_interval(days=>CASE WHEN n=1 THEN 1 WHEN n=2 THEN 2 WHEN n=3 THEN 4 ELSE 7 END);
    IF r IS NULL THEN
      UPDATE lotto.sync_state SET latest_failures=n,next_latest_at=clock_timestamp()+delay WHERE singleton;
    ELSE
      INSERT INTO lotto.sync_failures(round,attempts,next_retry_at,error_code)
        VALUES(r,n,clock_timestamp()+delay,p->>'code') ON CONFLICT(round) DO UPDATE SET
        attempts=n,next_retry_at=clock_timestamp()+delay,error_code=EXCLUDED.error_code,updated_at=clock_timestamp();
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
