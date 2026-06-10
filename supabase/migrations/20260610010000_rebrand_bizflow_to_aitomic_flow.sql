-- Rebrand: replace legacy "BizFlow" with "Aitomic Flow" in knowledge base
-- Applies to: article titles, slugs, and body content (EN + VI)

UPDATE knowledge_base
SET
  title      = replace(title, 'BizFlow', 'Aitomic Flow'),
  slug       = replace(slug,  'bizflow', 'aitomic-flow'),
  content_markdown = replace(content_markdown, 'BizFlow', 'Aitomic Flow'),
  updated_at       = NOW()
WHERE
  title            LIKE '%BizFlow%'
  OR slug          LIKE '%bizflow%'
  OR content_markdown LIKE '%BizFlow%';
