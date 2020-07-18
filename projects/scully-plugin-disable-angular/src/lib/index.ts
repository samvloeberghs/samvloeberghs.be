import { getPluginConfig, registerPlugin, scullyConfig } from '@scullyio/scully';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

export const DisableAngular = 'disableAngular';

export interface DisableAngularOptions {
  removeState: boolean;
}

const escapeRegExp = (string): string => {
  // $& means the whole matched string
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const disableAngularPlugin = (html: string) => {
  const disableAngularOptions = getPluginConfig<DisableAngularOptions>(DisableAngular, 'render');
  const tsConfigPath = join(scullyConfig.projectRoot, 'tsconfig.app.json');
  let tsConfig;
  try {
    tsConfig = JSON.parse(readFileSync(tsConfigPath, { encoding: 'utf8' }).toString());
  } catch (e) {
    console.log(`Error reading tsConfig at path ${tsConfigPath}`);
    console.error(e);
    throw new Error(e);
  }
  let isEs5Config = false;
  let statsJsonPath = join(scullyConfig.distFolder, 'stats-es2015.json');
  const target = tsConfig.compilerOptions.target ?? 'es2015';
  if (target === 'es5') {
    isEs5Config = true;
    statsJsonPath = join(scullyConfig.distFolder, 'stats.json');
  }

  if (!existsSync(statsJsonPath)) {
    const noStatsJsonError = `A ${isEs5Config ? 'stats' : 'stats-es2015'}.json is required for the 'disableAngular' plugin.
Please run 'ng build' with the '--stats-json' flag`;
    console.error(noStatsJsonError);
    throw new Error(noStatsJsonError);
  }

  const scullyDisableAngularStatsJsonPath = join(scullyConfig.distFolder, 'scully-plugin-disable-angular-stats.json');
  let scullyDisableAngularStatsJson = [];
  if (!existsSync(scullyDisableAngularStatsJsonPath)) {
    const errorCreatingScullyDisableAngularStatsJsonError = 'The scully-plugin-disable-angular-stats.json could not be created';
    try {
      scullyDisableAngularStatsJson = JSON.parse(readFileSync(statsJsonPath, { encoding: 'utf8' }).toString()).assets;
      writeFileSync(scullyDisableAngularStatsJsonPath, JSON.stringify(scullyDisableAngularStatsJson));
    } catch (e) {
      console.error(e);
      console.error(errorCreatingScullyDisableAngularStatsJsonError);
      throw new Error(errorCreatingScullyDisableAngularStatsJsonError);
    }
  } else {
    scullyDisableAngularStatsJson = JSON.parse(readFileSync(scullyDisableAngularStatsJsonPath, { encoding: 'utf8' }).toString());
  }

  let assetsList = scullyDisableAngularStatsJson
    .map(entry => entry['name'])
    .filter(entry => entry.includes('.js'));
  if (!isEs5Config) {
    assetsList = [...assetsList, ...assetsList.map(asset => {
      return asset.includes('-es5') ?
        asset.replace('-es5', '-es2015') :
        asset.replace('-es2015', '-es5');
    })];
  }

  assetsList.forEach(entry => {
    const regex = new RegExp(`<script( charset="?utf-8"?)? src="?${escapeRegExp(entry)}"?( type="?module"?)?( nomodule(="")?)?( defer(="")?)?><\/script>`, 'gmi');
    html = html.replace(regex, '');
  });

  if (disableAngularOptions.removeState) {
    const regex = new RegExp('<script id="ScullyIO-transfer-state">([\\S\\s]*?)<\\/script>');
    html = html.replace(regex, '');
  }

  return html;
};

// no validation implemented
const disableAngularPluginValidator = async () => [];
registerPlugin('render', DisableAngular, disableAngularPlugin);
