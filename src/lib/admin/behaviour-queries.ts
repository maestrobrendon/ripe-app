/*
 * The HogQL behind Insights → Behaviour. Each takes the window in days and
 * returns rows; src/lib/admin/behaviour.ts runs them against PostHog. Kept
 * apart (and free of server-only imports) so they can be tried against the
 * live project from a script before they ship.
 *
 * "Visits" are PostHog sessions: before someone accepts analytics cookies a
 * visit can't be tied to the next one, so sessions are the honest unit.
 */

const since = (days: number) => `timestamp > now() - interval ${Math.max(1, Math.min(365, Math.round(days)))} day`;

export const BEHAVIOUR_QUERIES = {
  overview: (d: number) => `
    select
      uniq(\`$session_id\`) as visits,
      countIf(event = '$pageview') as pageviews,
      uniqIf(person_id, event = '$identify') as signed_in,
      countIf(event = '$autocapture') as taps
    from events where ${since(d)}`,

  visitLength: (d: number) => `
    select quantile(0.5)(dur), avg(dur), countIf(views = 1) / greatest(count(), 1)
    from (
      select \`$session_id\` as s, dateDiff('second', min(timestamp), max(timestamp)) as dur, countIf(event = '$pageview') as views
      from events where ${since(d)} and notEmpty(\`$session_id\`)
      group by s
    )`,

  daily: (d: number) => `
    select toDate(timestamp) as day, uniq(\`$session_id\`) as visits, countIf(event = '$pageview') as views
    from events where ${since(d)}
    group by day order by day`,

  pages: (d: number) => `
    select properties.$pathname as path, count() as views, uniq(\`$session_id\`) as visits
    from events where ${since(d)} and event = '$pageview'
    group by path order by views desc limit 15`,

  timeOnPage: (d: number) => `
    select properties.$prev_pageview_pathname as path, avg(toFloat(properties.$prev_pageview_duration)) as secs, count() as n
    from events where ${since(d)} and event in ('$pageview', '$pageleave') and isNotNull(properties.$prev_pageview_duration)
    group by path order by n desc limit 30`,

  sections: (d: number) => `
    select properties.section as section, sum(least(toFloat(properties.seconds), 600)) as total, avg(least(toFloat(properties.seconds), 600)) as average, count() as views
    from events where ${since(d)} and event = 'section_viewed'
    group by section order by total desc limit 20`,

  clicks: (d: number) => `
    select properties.$el_text as label, properties.$pathname as path, count() as n
    from events where ${since(d)} and event = '$autocapture' and properties.$event_type = 'click' and notEmpty(properties.$el_text)
    group by label, path order by n desc limit 15`,

  recipePages: (d: number) => `
    select replaceRegexpOne(properties.$pathname, '^/recipes/', '') as recipe, count() as views, uniq(\`$session_id\`) as visits
    from events where ${since(d)} and event = '$pageview' and properties.$pathname like '/recipes/%' and properties.$pathname != '/recipes/saved'
    group by recipe order by views desc limit 12`,

  recipeActions: (d: number) => `
    select event, toString(properties.recipe) as recipe, count() as n
    from events where ${since(d)} and event in ('recipe_opened', 'recipe_saved', 'recipe_unsaved')
    group by event, recipe order by n desc limit 40`,

  products: (d: number) => `
    select properties.name as product, countIf(event = 'product_added') as added, countIf(event = 'product_removed') as removed
    from events where ${since(d)} and event in ('product_added', 'product_removed')
    group by product order by added desc limit 12`,

  kachi: (d: number) => `
    select
      countIf(event = 'kachi_message_sent') as messages,
      uniqIf(\`$session_id\`, event = 'kachi_message_sent') as chats,
      quantileIf(0.5)(toFloat(properties.ms), event = 'kachi_replied') as p50,
      quantileIf(0.9)(toFloat(properties.ms), event = 'kachi_replied') as p90,
      countIf(event = 'kachi_replied' and properties.ok = false) as failed,
      countIf(event = 'kachi_replied' and properties.changedBasket = true) as changed
    from events where ${since(d)} and event in ('kachi_message_sent', 'kachi_replied')`,

  funnel: (d: number) => `
    select
      uniqIf(\`$session_id\`, event = '$pageview') as visited,
      uniqIf(\`$session_id\`, event = 'product_added') as added,
      uniqIf(\`$session_id\`, event = 'checkout_submitted') as submitted,
      uniqIf(\`$session_id\`, event = 'checkout_failed') as failed
    from events where ${since(d)}`,

  devices: (d: number) => `
    select coalesce(properties.$device_type, 'Unknown') as device, uniq(\`$session_id\`) as visits
    from events where ${since(d)} and event = '$pageview'
    group by device order by visits desc`,

  sources: (d: number) => `
    select coalesce(nullIf(properties.$referring_domain, '$direct'), 'Direct') as source, uniq(\`$session_id\`) as visits
    from events where ${since(d)} and event = '$pageview' and properties.$referring_domain not like '%getbasket.ng'
    group by source order by visits desc limit 10`,

  vitals: (d: number) => `
    select
      quantile(0.75)(toFloat(properties.$web_vitals_LCP_value)) as lcp,
      quantile(0.75)(toFloat(properties.$web_vitals_INP_value)) as inp,
      quantile(0.75)(toFloat(properties.$web_vitals_CLS_value)) as cls,
      quantile(0.75)(toFloat(properties.$web_vitals_FCP_value)) as fcp
    from events where ${since(d)} and event = '$web_vitals'`,

  friction: (d: number) => `
    select properties.$pathname as path, countIf(event = '$rageclick') as rage, countIf(event = '$dead_click') as dead
    from events where ${since(d)} and event in ('$rageclick', '$dead_click')
    group by path order by rage + dead desc limit 10`,

  consent: (d: number) => `
    select toString(properties.choice) as choice, count() as n
    from events where ${since(d)} and event in ('cookie_consent', 'analytics_consent')
    group by choice`,
} as const;

export type BehaviourQuery = keyof typeof BEHAVIOUR_QUERIES;
