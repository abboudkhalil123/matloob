-- MATLOOB QA: fix attachment storage_path checks.
-- The original constraints used a double backslash before the dot in the
-- PostgreSQL regex, which makes valid paths such as UUID/UUID.png fail.
-- Keep the required format: <entity UUID>/<file UUID>.<allowed extension>

alter table public.request_attachments
  drop constraint if exists request_attachments_storage_path_check;

alter table public.request_attachments
  add constraint request_attachments_storage_path_check
  check (storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|pdf)$');

alter table public.offer_attachments
  drop constraint if exists offer_attachments_storage_path_check;

alter table public.offer_attachments
  add constraint offer_attachments_storage_path_check
  check (storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|pdf)$');
