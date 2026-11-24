-- 016: Thông báo đẩy nhắc giờ (SPEC §13, v0.2). Chạy sau 015. Chạy lại được.
--  * push_subs   : máy đã bật thông báo (mỗi người chỉ thấy máy của mình — RLS).
--  * push_sent   : nhắc nào đã gửi ngày nào (mỗi nhắc 1 lần / ngày).
--  * push_keys   : khoá của Worker Cloudflare "okrs-push" (chỉ lưu mã băm sha256 — Luca tự thêm, KHÔNG để trong repo).
--  * settings    : thêm giờ nhắc (đổi ở Cài đặt → Nhắc giờ).
--  * push_due(khoá): Worker gọi mỗi 5 phút → danh sách nhắc đến giờ + máy nhận; đánh dấu đã gửi ngay trong lần gọi.
--  Giờ tính theo Việt Nam (Asia/Ho_Chi_Minh). Nhắc chỉ gửi trong 30 phút sau giờ hẹn (Worker trễ / máy chủ nghỉ thì bỏ, không gửi muộn).

-- ---------- Giờ nhắc (Cài đặt)
alter table public.settings
  add column if not exists push_kaizen_final_min int  not null default 15,       -- nhắc lần 2: x phút trước giờ chốt Kaizen
  add column if not exists push_okr_lead_min     int  not null default 30,       -- nhắc chốt OKR: x phút trước hạn chốt OKR sáng
  add column if not exists push_week_time        time not null default '20:00',  -- Chủ nhật: nhắc rà tuần
  add column if not exists push_month_time       time not null default '20:00';  -- ngày cuối tháng: nhắc rà tháng / quý
alter table public.settings drop constraint if exists settings_push_final_check;
alter table public.settings add constraint settings_push_final_check check (push_kaizen_final_min between 5 and 120);
alter table public.settings drop constraint if exists settings_push_okr_check;
alter table public.settings add constraint settings_push_okr_check check (push_okr_lead_min between 5 and 180);

-- ---------- Máy nhận
create table if not exists public.push_subs (
  endpoint    text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh      text not null,
  auth_key    text not null,
  ua          text,
  prefs       jsonb not null default '{"kaizen": true, "kaizen_final": true, "okr": true, "week": true, "month": true}'::jsonb,
  welcomed    boolean not null default false,
  created_at  timestamptz not null default now(),
  last_ok     timestamptz
);
alter table public.push_subs enable row level security;
drop policy if exists push_subs_own on public.push_subs;
create policy push_subs_own on public.push_subs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.push_subs to authenticated;

-- ---------- Đã gửi
create table if not exists public.push_sent (
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind     text not null,
  day      date not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, kind, day)
);
alter table public.push_sent enable row level security;
drop policy if exists push_sent_own on public.push_sent;
create policy push_sent_own on public.push_sent for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.push_sent to authenticated;

-- ---------- Khoá Worker (chỉ mã băm; không ai đọc được qua API)
create table if not exists public.push_keys (
  key_hash  text primary key,
  label     text,
  created_at timestamptz not null default now()
);
alter table public.push_keys enable row level security;
revoke all on public.push_keys from anon, authenticated;

create or replace function public._push_key_ok(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.push_keys where key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex'))
$$;
revoke all on function public._push_key_ok(text) from public, anon, authenticated;

-- ---------- Nhắc đến giờ (Worker gọi mỗi 5 phút)
-- Trả về {items: [{endpoint, p256dh, auth, title, body, url, tag}], now}
create or replace function public.push_due(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  vn   timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  d    date := vn::date;
  t    time := vn::time;
  ws   date := d - (extract(isodow from d)::int - 1);           -- thứ Hai của tuần
  ms   date := date_trunc('month', d)::date;
  last_day boolean := (d + 1) = (date_trunc('month', d) + interval '1 month')::date;
  q_end    boolean := last_day and extract(month from d)::int in (3, 6, 9, 12);
  u    record; s record; p record; v_kind text; fire time;
  items jsonb := '[]'::jsonb; due jsonb;
  base text := '/okrs-kaizen/';
begin
  if not public._push_key_ok(p_key) then raise exception 'khoá không hợp lệ' using errcode = '28000'; end if;

  -- Máy mới bật: gửi 1 thông báo thử
  for u in update public.push_subs set welcomed = true where not welcomed returning endpoint, p256dh, auth_key loop
    items := items || jsonb_build_object('endpoint', u.endpoint, 'p256dh', u.p256dh, 'auth', u.auth_key, 'tag', 'welcome',
      'title', '✅ Đã bật nhắc giờ OKRs', 'body', 'Máy này sẽ nhận nhắc chốt Kaizen, chốt OKR, rà tuần / tháng.', 'url', base);
  end loop;

  for s in select st.* from public.settings st where exists (select 1 from public.push_subs ps where ps.user_id = st.user_id) loop
    due := '[]'::jsonb;
    select * into p from public.periods where user_id = s.user_id and kind = 'day' and start_date = d;

    -- 1) Kaizen hôm nay chưa xác nhận: giờ nhắc (giờ chốt − lead) và lần 2 (giờ chốt − x phút)
    if not coalesce(p.kaizen ? 'confirmed_at', false) then
      fire := s.lock_time - make_interval(mins => s.remind_lead_min);
      if t >= fire and t < fire + interval '30 minutes' then
        due := due || jsonb_build_object('kind', 'kaizen', 'title', '🌙 Chốt Kaizen hôm nay',
          'body', 'Còn ' || s.remind_lead_min || ' phút đến giờ chốt ' || to_char(s.lock_time, 'HH24:MI') || '. Làm & xác nhận Kaizen hôm nay, rồi lập OKR ngày mai.',
          'url', base || '?go=today');
      end if;
      fire := s.lock_time - make_interval(mins => s.push_kaizen_final_min);
      if t >= fire and t < fire + interval '30 minutes' then
        due := due || jsonb_build_object('kind', 'kaizen_final', 'title', '⏰ Sắp hết giờ chốt Kaizen',
          'body', 'Còn ' || s.push_kaizen_final_min || ' phút (chốt ' || to_char(s.lock_time, 'HH24:MI') || '). Kaizen hôm nay vẫn chưa xác nhận.',
          'url', base || '?go=today');
      end if;
    end if;

    -- 2) OKR hôm nay chưa chốt (hạn chốt sáng)
    if coalesce(p.status, 'draft') <> 'locked' then
      fire := s.okr_lock_time - make_interval(mins => s.push_okr_lead_min);
      if t >= fire and t < fire + interval '30 minutes' then
        due := due || jsonb_build_object('kind', 'okr', 'title', '☀️ Chốt OKR hôm nay',
          'body', case when p.id is null then 'Chưa lập OKR hôm nay. ' else 'OKR hôm nay chưa chốt. ' end
                  || 'Hạn chốt ' || to_char(s.okr_lock_time, 'HH24:MI') || '.',
          'url', base || '?go=today');
      end if;
    end if;

    -- 3) Chủ nhật: rà tuần (Kaizen tuần chưa có bài học / nguyên nhân)
    if extract(isodow from d) = 7 and t >= s.push_week_time and t < s.push_week_time + interval '30 minutes' then
      select * into p from public.periods where user_id = s.user_id and kind = 'week' and start_date = ws;
      if not (coalesce(jsonb_array_length(case when jsonb_typeof(p.kaizen -> 'lessons') = 'array' then p.kaizen -> 'lessons' end), 0) > 0
              or coalesce(btrim(p.kaizen ->> 'causes'), '') <> '') then
        due := due || jsonb_build_object('kind', 'week', 'title', '📅 Rà tuần',
          'body', 'Hôm nay Chủ nhật: làm Kaizen tuần + lập OKR tuần mới (30 phút).', 'url', base || '?go=week');
      end if;
    end if;

    -- 4) Ngày cuối tháng: rà tháng (và quý nếu là tháng cuối quý) — Kaizen số liệu chưa quyết định đủ KR, chưa ghi lý do bỏ
    if last_day and t >= s.push_month_time and t < s.push_month_time + interval '30 minutes' then
      select * into p from public.periods where user_id = s.user_id and kind = 'month' and start_date = ms;
      if p.id is not null and coalesce(btrim(p.kaizen ->> 'skip_reason'), '') = ''
         and exists (select 1 from public.key_results k where k.period_id = p.id
                     and not coalesce(p.kaizen -> 'decisions' ? k.id::text, false)) then
        due := due || jsonb_build_object('kind', 'month', 'title', case when q_end then '🗓️ Rà tháng + quý' else '🗓️ Rà tháng' end,
          'body', 'Hôm nay cuối tháng: làm Kaizen số liệu' || case when q_end then ' tháng và quý' else ' tháng' end || ' + OKR tháng mới.',
          'url', base || '?go=month');
      end if;
    end if;

    -- Mỗi nhắc 1 lần / ngày → gửi tới mọi máy của người này đã bật loại nhắc đó
    for v_kind in select x ->> 'kind' from jsonb_array_elements(due) x loop
      insert into public.push_sent (user_id, kind, day) values (s.user_id, v_kind, d) on conflict do nothing;
      if not found then continue; end if;
      items := items || coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth_key, 'tag', v_kind,
                 'title', (select x ->> 'title' from jsonb_array_elements(due) x where x ->> 'kind' = v_kind limit 1),
                 'body',  (select x ->> 'body'  from jsonb_array_elements(due) x where x ->> 'kind' = v_kind limit 1),
                 'url',   (select x ->> 'url'   from jsonb_array_elements(due) x where x ->> 'kind' = v_kind limit 1)))
        from public.push_subs ps
        where ps.user_id = s.user_id and coalesce((ps.prefs ->> v_kind)::boolean, true)), '[]'::jsonb);
    end loop;
  end loop;
  return jsonb_build_object('now', vn, 'items', items);
end $$;
revoke all on function public.push_due(text) from public, authenticated;
grant execute on function public.push_due(text) to anon;

-- Worker báo kết quả: máy hết hạn (404/410) → xoá; gửi được → ghi last_ok
create or replace function public.push_report(p_key text, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._push_key_ok(p_key) then raise exception 'khoá không hợp lệ' using errcode = '28000'; end if;
  delete from public.push_subs where endpoint in (select jsonb_array_elements_text(coalesce(p -> 'dead', '[]'::jsonb)));
  update public.push_subs set last_ok = now() where endpoint in (select jsonb_array_elements_text(coalesce(p -> 'ok', '[]'::jsonb)));
end $$;
revoke all on function public.push_report(text, jsonb) from public, authenticated;
grant execute on function public.push_report(text, jsonb) to anon;
