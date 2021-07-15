export const marketMakerFactoryAbi = [
  `function create2FixedProductMarketMaker(
     uint saltNonce,
     address conditionalTokens,
     address collateralToken,
     bytes32[] conditionIds,
     uint fee,
     uint initialFunds,
     uint[] distributionHint
  ) public returns (address)`,
  'function implementationMaster() public constant returns (address)',
  `event FixedProductMarketMakerCreation(address indexed creator, address fixedProductMarketMaker, address conditionalTokens, address collateralToken, bytes32[] conditionIds, uint fee)`,
]

export const marketMakerFactoryCallAbi = [
  `function create2FixedProductMarketMaker(
     uint saltNonce,
     address conditionalTokens,
     address collateralToken,
     bytes32[] conditionIds,
     uint fee,
     uint initialFunds,
     uint[] distributionHint
  ) public constant returns (address)`,
]
const marketMakerAbi = [
  'function conditionalTokens() external view returns (address)',
  'function balanceOf(address addr) external view returns (uint256)',
  'function collateralToken() external view returns (address)',
  'function fee() external view returns (uint)',
  'function conditionIds(uint256) external view returns (bytes32)',
  'function addFunding(uint addedFunds, uint[] distributionHint) external',
  'function removeFunding(uint sharesToBurn) external',
  'function totalSupply() external view returns (uint256)',
  'function collectedFees() external view returns (uint)',
  'function feesWithdrawableBy(address addr) public view returns (uint)',
  'function buy(uint investmentAmount, uint outcomeIndex, uint minOutcomeTokensToBuy) external',
  'function calcBuyAmount(uint investmentAmount, uint outcomeIndex) public view returns (uint)',
  'function sell(uint returnAmount, uint outcomeIndex, uint maxOutcomeTokensToSell) external',
  'function calcSellAmount(uint returnAmount, uint outcomeIndex) public view returns (uint)',
]
