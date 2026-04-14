const path = require('path');

module.exports = {
  LifiBridgeStrategy: require(path.resolve('./packages/shared/dist/services/swap/strategies/lifi-bridge.strategy.js')).LiFiBridgeStrategy,
  LifiEarnStrategy: require(path.resolve('./packages/shared/dist/services/swap/strategies/lifi-earn.strategy.js')).LiFiEarnStrategy,
  EarnService: require(path.resolve('./packages/shared/dist/services/earn-service.js')).EarnService,
  VaultService: require(path.resolve('./packages/shared/dist/services/vault/vault.service.js')).VaultService,
  YieldAdvisorService: require(path.resolve('./packages/shared/dist/services/earn-service.js')).YieldAdvisorService,
};
