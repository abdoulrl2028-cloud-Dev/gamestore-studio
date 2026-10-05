const { withAppBuildGradle, withDangerousMod, withProjectBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withAndroidReleaseSigning(config) {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const androidApp = path.join(cfg.modRequest.platformProjectRoot, 'app');
      const keystore = path.join(projectRoot, 'signing', 'gamestore-upload.jks');
      const properties = path.join(projectRoot, 'signing', 'keystore.properties');
      if (fs.existsSync(keystore)) fs.copyFileSync(keystore, path.join(androidApp, 'gamestore-upload.jks'));
      if (fs.existsSync(properties)) {
        fs.copyFileSync(properties, path.join(cfg.modRequest.platformProjectRoot, 'keystore.properties'));
      }
      return cfg;
    },
  ]);

  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy' || cfg.modResults.contents.includes('GAMESTORE_RELEASE_SIGNING')) {
      return cfg;
    }
    let contents = cfg.modResults.contents;
    const loader = `
def gamestoreKeystorePropertiesFile = rootProject.file("keystore.properties")
def gamestoreKeystoreProperties = new Properties()
if (gamestoreKeystorePropertiesFile.exists()) {
    gamestoreKeystoreProperties.load(new FileInputStream(gamestoreKeystorePropertiesFile))
}
`;
    contents = loader + contents;
    contents = contents.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        release {
            // GAMESTORE_RELEASE_SIGNING
            if (gamestoreKeystorePropertiesFile.exists()) {
                storeFile file(gamestoreKeystoreProperties['storeFile'])
                storePassword gamestoreKeystoreProperties['storePassword']
                keyAlias gamestoreKeystoreProperties['keyAlias']
                keyPassword gamestoreKeystoreProperties['keyPassword']
            }
        }`,
    );
    contents = contents.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release',
    );
    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy' || cfg.modResults.contents.includes('lintvital')) {
      return cfg;
    }
    cfg.modResults.contents += `
subprojects { subproject ->
  subproject.tasks.configureEach { task ->
    if (task.name.toLowerCase().contains('lintvital')) {
      task.enabled = false
    }
  }
}
`;
    return cfg;
  });

  return config;
}

module.exports = withAndroidReleaseSigning;
