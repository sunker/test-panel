const fs = require('fs');
const path = require('path');

async function checkUrlExists(url) {
  try {
    const response = await fetch(url);
    return response.status !== 404;
  } catch (error) {
    console.error('Error fetching URL:', error);
    return false; // Assume false if there's an error (e.g., network issue)
  }
}

async function buildPrComment() {
  // Ensure we are in the right directory
  const reportsDir = 'all-reports';
  if (!fs.existsSync(reportsDir) || !fs.statSync(reportsDir).isDirectory()) {
    console.error('Failed to enter directory all-reports');
    process.exit(1);
  }

  // Initialize the table variable
  let table = '### Playwright test results';

  // Check if any summary.txt has a PLUGIN_NAME value
  const summaryFiles = fs
    .readdirSync(reportsDir)
    .map((dir) => path.join(reportsDir, dir, 'summary.txt'))
    .filter((file) => fs.existsSync(file));

  const usePluginName = summaryFiles.some((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const match = content.match(/^PLUGIN_NAME=(.+)$/m);
    return match && match[1].trim() !== '';
  });

  if (usePluginName) {
    table +=
      '\n| Plugin Name | Image Name | Version | Result | Report |\n|:----------- |:---------- |:------- |:------: |:------: |';
  } else {
    table += '\n| Image Name | Version | Result | Report |\n|:---------- |:------- |:------: |:------: |';
  }

  // Initialize an array to store rows
  let rows = [];
  let uploadReportDisabled = false;
  let lastReportLink = '';

  // Iterate through subdirectories
  fs.readdirSync(reportsDir).forEach((dir) => {
    const dirPath = path.join(reportsDir, dir);
    if (!fs.statSync(dirPath).isDirectory()) return;

    const summaryFile = path.join(dirPath, 'summary.txt');
    if (!fs.existsSync(summaryFile)) {
      console.warn(`Warning: summary.txt not found in ${dir}`);
      return;
    }

    // Read data from summary.txt
    const content = fs.readFileSync(summaryFile, 'utf8');
    const getValue = (key) => (content.match(new RegExp(`${key}=(.*)`)) || [])[1]?.trim() || '';

    const grafanaImage = getValue('GRAFANA_IMAGE');
    const grafanaVersion = getValue('GRAFANA_VERSION');
    const testOutput = getValue('OUTPUT');
    const pluginName = getValue('PLUGIN_NAME');
    uploadReportDisabled = getValue('UPLOAD_REPORT_ENABLED') === 'false';

    // Construct report link
    const repoOwner = process.env.GITHUB_REPOSITORY_OWNER;
    const repoName = process.env.GITHUB_REPOSITORY_NAME;
    const timestamp = process.env.TIMESTAMP;
    const jobInitiator = process.env.JOB_INITIATOR;
    const branchName = process.env.BRANCH;

    const reportLink = pluginName
      ? `https://${repoOwner}.github.io/${repoName}/${timestamp}/${jobInitiator}/${pluginName}-${grafanaImage}-${grafanaVersion}/`
      : `https://${repoOwner}.github.io/${repoName}/${timestamp}/${jobInitiator}/${grafanaImage}-${grafanaVersion}/`;

    // Map result to emoji
    const resultEmoji = testOutput === 'success' ? '✅' : '❌';

    // Check for index.html
    const hasReport = fs.existsSync(path.join(dirPath, 'index.html'));
    const reportCell = hasReport ? `[View report](${reportLink})` : ' ';

    if (hasReport) {
      lastReportLink = reportLink;
    }

    // Add row to table
    if (usePluginName) {
      rows.push(`| ${pluginName} | ${grafanaImage} | ${grafanaVersion} | ${resultEmoji} | ${reportCell} |`);
    } else {
      rows.push(`| ${grafanaImage} | ${grafanaVersion} | ${resultEmoji} | ${reportCell} |`);
    }
  });

  // Sort rows by version (assuming <major>.<minor>.<patch> format)
  rows.sort((a, b) => {
    const getVersion = (row) => row.split('|')[usePluginName ? 3 : 2].trim();
    return getVersion(b).localeCompare(getVersion(a), undefined, { numeric: true });
  });

  // Add sorted rows to table
  table += '\n' + rows.join('\n');

  if (uploadReportDisabled) {
    table +=
      '\n > **_NOTE:_**  To be able to browse the Playwright reports for failing end-to-end tests, enable the `upload-report` input in the `upload-report-artifacts` Action.';
  }

  const urlExist = await checkUrlExists(lastReportLink);
  if (!urlExist) {
    table += `\n > **_WARNING:_**  The reports were deployed to GitHub Pages, but it seems like GitHub Pages is not configured to deploy from ${branchName}. For details, refer to the [README](https://github.com/grafana/plugin-actions/main/deploy-report-pages/README.md) for the deploy-report-pages Action.`;
  }

  console.log(table);
}

buildPrComment();
