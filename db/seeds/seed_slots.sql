BEGIN;

-- Generate slots for the next 30 days for all attractions
-- Multiple time slots per day for each attraction

-- Function to generate slots for an attraction
DO $$
DECLARE
  attraction RECORD;
  slot_date DATE;
  time_slots TIME[][];
  time_pair TIME[];
  days_ahead INT := 30;
  day_count INT;
BEGIN
  -- Define time slot pairs (start_time, end_time)
  time_slots := ARRAY[
    ARRAY['09:00:00'::TIME, '10:30:00'::TIME],
    ARRAY['10:30:00'::TIME, '12:00:00'::TIME],
    ARRAY['12:00:00'::TIME, '13:30:00'::TIME],
    ARRAY['13:30:00'::TIME, '15:00:00'::TIME],
    ARRAY['15:00:00'::TIME, '16:30:00'::TIME],
    ARRAY['16:30:00'::TIME, '18:00:00'::TIME],
    ARRAY['18:00:00'::TIME, '19:30:00'::TIME]
  ];

  -- Loop through all active attractions
  FOR attraction IN SELECT attraction_id, slot_capacity, slug FROM attractions WHERE active = TRUE
  LOOP
    -- Generate slots for the next 30 days
    FOR day_count IN 0..days_ahead
    LOOP
      slot_date := CURRENT_DATE + day_count;
      
      -- Insert slots for each time pair
      FOREACH time_pair SLICE 1 IN ARRAY time_slots
      LOOP
        INSERT INTO attraction_slots (
          attraction_id,
          start_date,
          end_date,
          start_time,
          end_time,
          capacity,
          available
        )
        VALUES (
          attraction.attraction_id,
          slot_date,
          slot_date,
          time_pair[1],
          time_pair[2],
          attraction.slot_capacity,
          TRUE
        )
        ON CONFLICT (attraction_id, start_date, end_date, start_time, end_time) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
