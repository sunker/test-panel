import * as semver from 'semver';
import { test, expect } from '@grafana/plugin-e2e';

test('should display "No data" in case panel data is empty', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '2' });
  await expect(panelEditPage.panel.locator).toContainText('No data');
});

test('should display circle when data is passed to the panel', async ({
  panelEditPage,
  readProvisionedDataSource,
  page,
  grafanaVersion,
}) => {
  test.fail(semver.gte(grafanaVersion, '11.3.0'), 'failing test');
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await panelEditPage.datasource.set(ds.name);
  await panelEditPage.setVisualization('Test');
  await expect(page.getByTestId('simple-panel-circle')).toBeVisible();
});
