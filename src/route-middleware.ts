import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

/** Shows only the sidebar groups of the current top-level tab. */
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const section = route.id.split('/')[0];
  const label = section === 'deployment' ? 'Deployment' : section === 'reference' ? 'Reference' : 'Documentation';
  const tab = route.sidebar.find((entry) => entry.type === 'group' && entry.label === label);
  if (tab?.type === 'group') route.sidebar = tab.entries;
});
