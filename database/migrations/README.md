# Migrations — Historical Reference Only

These files are kept for historical reference. **Do not run them against a
database that was created from the current `schema.sql`** — every change they
contain is already incorporated there.

| File | What it added | Now in schema.sql |
|---|---|---|
| `001_instructor_profile.sql` | `ata_member_number`, `certification_level`, `is_available_for_testing`, `is_available_for_seminars` columns on `instructors`; `instructor_specialties` table | ✅ |
| `002_school_management.sql` | `head_instructor_name` column on `schools`; `school_instructors` table | ✅ |
| `003_booking_system.sql` | `requested_time`, `location_name`, `required_rank`, `judges_needed` columns on `judge_requests` | ✅ |
| *(no file)* | `judges_needed`, `required_judge_rank` columns on `events` | ✅ |

## Setting up a fresh database

```bash
mysql -u <user> -p <database> < database/schema.sql
mysql -u <user> -p <database> < database/seed.sql   # dev only
```

That's it — no migrations needed.
