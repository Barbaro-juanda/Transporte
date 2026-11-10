-- Convierte en "conductor" (admin) al usuario que creaste en Supabase: Authentication → Users → Add user
-- (con correo y contraseña, marcando "Auto Confirm User"). Reemplaza el correo y ejecuta esto en el SQL Editor.

insert into profiles (id, role, full_name, email)
select id, 'driver', 'Conductor', email
from auth.users
where email = 'TU-CORREO@ejemplo.com';
