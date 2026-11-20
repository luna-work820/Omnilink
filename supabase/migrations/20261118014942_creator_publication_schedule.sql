create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('creator-publications-due','* * * * *','select private.publish_due_creator_posts();');
