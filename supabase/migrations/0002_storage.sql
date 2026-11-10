-- Almacenamiento privado de capturas de transferencias.
-- Ruta de cada archivo: receipts/{id_de_la_pasajera}/{archivo}. Solo la dueña y el conductor pueden leerlo.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy receipts_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy receipts_read_own_or_driver on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_driver()));
