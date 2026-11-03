-- Supabase default grants can include UPDATE/DELETE for service_role.
-- Application saves only append revisions; old versions cannot be overwritten.
revoke all on public.certificate_template_versions, public.certificate_document_versions from service_role;
grant select,insert on public.certificate_template_versions, public.certificate_document_versions to service_role;
