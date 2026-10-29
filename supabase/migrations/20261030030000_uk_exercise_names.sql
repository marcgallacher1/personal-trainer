-- UK naming: "Farmer's Carry" is "Farmer's Walk" in UK gyms. Same ID, so logged history stays linked.
update public.exercises set name = 'Farmer''s Walk' where id = '6cc2c62d-c3d8-5c7d-aed2-019a15aa7f74' and user_id is null;
