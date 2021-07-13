import { useQuery } from '@apollo/react-hooks'
import { BigNumber } from 'ethers/utils'
import React, { ChangeEvent, useEffect, useState } from 'react'

import { IMPORT_QUESTION_ID_KEY, MARKET_FEE } from '../../../../common/constants'
import { useConnectedWeb3Context } from '../../../../contexts/connectedWeb3'
import { queryTopCategories } from '../../../../queries/markets_home'
import { MarketCreationStatus } from '../../../../util/market_creation_status_data'
import { getArbitrator, getDefaultArbitrator, getDefaultToken, getToken } from '../../../../util/networks'
import { getCTokenForToken, limitDecimalPlaces } from '../../../../util/tools'
import { Arbitrator, GraphResponseTopCategories, MarketData, Question, Token } from '../../../../util/types'
import { BigNumberInputReturn } from '../../../common/form/big_number_input'

import { AskQuestionStep, FundingAndFeeStep, MenuStep } from './steps'
import { Outcome } from './steps/outcomes'

interface Props {
  callback: (param: MarketData, isScalar: boolean) => void
  marketCreationStatus: MarketCreationStatus
  marketMakerAddress: string | null
  getCompoundInterestRate: (symbol: string) => Promise<number>
}

export const MarketWizardCreator = (props: Props) => {
  const context = useConnectedWeb3Context()
  const { networkId, relay } = context

  const { callback, getCompoundInterestRate, marketCreationStatus } = props

  const defaultCollateral = getDefaultToken(networkId, relay)
  const defaultArbitrator = getDefaultArbitrator(networkId)

  const getImportQuestionId = () => {
    const reQuestionId = /(0x[0-9A-Fa-f]{64})/

    const questionId = localStorage.getItem(IMPORT_QUESTION_ID_KEY)

    if (!questionId) return null
    localStorage.removeItem(IMPORT_QUESTION_ID_KEY)

    return questionId.match(reQuestionId) ? questionId : null
  }

  const marketDataDefault: MarketData = {
    arbitrator: defaultArbitrator,
    arbitratorsCustom: [],
    categoriesCustom: [],
    category: '',
    collateral: defaultCollateral,
    userInputCollateral: defaultCollateral,
    compoundInterestRate: '',
    funding: new BigNumber('0'),
    loadedQuestionId: getImportQuestionId(),
    useCompoundReserve: false,
    outcomes: [
      {
        name: '',
        probability: 50,
      },
      {
        name: '',
        probability: 50,
      },
    ],
    question: '',
    resolution: null,
    spread: MARKET_FEE,
    lowerBound: null,
    upperBound: null,
    startingPoint: null,
    unit: '',
  }

  const [currentStep, setCurrentStep] = useState(1)
  const [marketData, setMarketdata] = useState<MarketData>(marketDataDefault)
  const [first, setFirst] = useState<number>(19)
  const [loadMoreButton, setLoadMoreButton] = useState<boolean>(true)

  useEffect(() => {
    let isSubscribed = true

    const updateMarketData = async () => {
      const collateral = getDefaultToken(networkId, relay)
      const arbitrator = getArbitrator(networkId, marketData.arbitrator.id)

      const newMarketData = {
        ...marketData,
        collateral,
        arbitrator,
      }

      if (isSubscribed) {
        setMarketdata(newMarketData)
      }
    }

    updateMarketData()

    return () => {
      isSubscribed = false
    }
    /* NOTE: The linter want us to add marketData to the dependency array, but it
    creates a sort of infinite loop, so I'm not gonna do it for now */
    // eslint-disable-next-line
  }, [networkId])

  const { data: topCategories } = useQuery<GraphResponseTopCategories>(queryTopCategories, {
    notifyOnNetworkStatusChange: true,
    variables: { first },
  })

  useEffect(() => {
    if (topCategories) {
      const categoriesCustom: string[] = topCategories.categories.map(category => category.id)

      const newMarketData = {
        ...marketData,
        categoriesCustom,
      }

      setMarketdata(newMarketData)

      setLoadMoreButton(first <= categoriesCustom.length)
    }
    /* NOTE: The linter want us to add marketData to the dependency array, but it
    creates a sort of infinite loop, so I'm not gonna do it for now */
    // eslint-disable-next-line
  }, [topCategories])

  const [currentFormState, setCurrentFormState] = useState('')

  const next = (state: string): void => {
    const actualCurrentStep = currentStep >= 3 ? 4 : currentStep + 1
    setCurrentStep(actualCurrentStep)
    setCurrentFormState(state)
  }

  const back = (state: string): void => {
    const actualCurrentStep = currentStep <= 1 ? 1 : currentStep - 1
    setCurrentStep(actualCurrentStep)
    setCurrentFormState(state)
  }

  const addArbitratorCustom = (arbitrator: Arbitrator): void => {
    const arbitratorsCustom = marketData.arbitratorsCustom
    arbitratorsCustom.push(arbitrator)
    const newMarketData = {
      ...marketData,
      arbitratorsCustom,
    }
    setMarketdata(newMarketData)
  }

  const addCategoryCustom = (category: string): void => {
    const categoriesCustom = marketData.categoriesCustom
    categoriesCustom.push(category)
    const newMarketData = {
      ...marketData,
      categoriesCustom,
    }
    setMarketdata(newMarketData)
  }

  const handleChange = (
    event:
      | ChangeEvent<HTMLInputElement>
      | ChangeEvent<HTMLSelectElement>
      | BigNumberInputReturn
      | ChangeEvent<HTMLButtonElement>,
  ) => {
    const { name, value } = 'target' in event ? event.target : event

    const newMarketData = {
      ...marketData,
      [name]:
        name === 'category'
          ? (value as string).toLowerCase()
          : name === 'spread'
          ? limitDecimalPlaces(value as string, 2)
          : value,
    }
    setMarketdata(newMarketData)
  }

  const resetTradingFee = () => {
    const newMarketData = {
      ...marketData,
      spread: MARKET_FEE,
    }
    setMarketdata(newMarketData)
  }

  const handleArbitratorChange = (arbitrator: Arbitrator) => {
    const newMarketData = {
      ...marketData,
      arbitrator,
    }
    setMarketdata(newMarketData)
  }

  const handleQuestionChange = (
    questionObj: Question,
    arbitrator: Arbitrator,
    outcomes: Outcome[],
    verifyLabel?: string,
  ) => {
    const { category, id: questionId, resolution, title: question } = questionObj

    setMarketdata(prevMarketData => ({
      ...prevMarketData,
      arbitrator,
      question,
      category,
      resolution,
      outcomes,
      loadedQuestionId: questionId,
      verifyLabel,
    }))
  }

  const handleUseCompoundReserveChange = (useCompoundReserve: boolean) => {
    let collateral = marketData.userInputCollateral
    if (useCompoundReserve) {
      collateral = getCompoundCollateral(collateral)
    }
    const newMarketData = {
      ...marketData,
      collateral,
      useCompoundReserve: useCompoundReserve,
    }
    setMarketdata(newMarketData)
  }

  const getCompoundCollateral = (collateral: Token): Token => {
    const collateralSymbol = collateral.symbol.toLowerCase()
    const compoundCollateralToken = getCTokenForToken(collateralSymbol) as KnownToken
    const compoundTokenDetails = getToken(context.networkId, compoundCollateralToken)
    return compoundTokenDetails
  }

  const handleCollateralChange = (collateral: Token, amount: BigNumber) => {
    const newMarketData = {
      ...marketData,
      funding: amount,
      collateral,
      userInputCollateral: collateral,
    }
    setMarketdata(newMarketData)
  }

  const handleTradingFeeChange = (fee: string) => {
    const newMarketData = {
      ...marketData,
      spread: parseFloat(fee),
    }
    setMarketdata(newMarketData)
  }

  const handleClearQuestion = () => {
    const newMarketData = {
      ...marketData,
      question: '',
      category: '',
      resolution: null,
      arbitrator: defaultArbitrator,
      outcomes: [
        {
          name: '',
          probability: 50,
        },
        {
          name: '',
          probability: 50,
        },
      ],
      loadedQuestionId: null,
    }

    setMarketdata(newMarketData)
  }

  const handleOutcomesChange = (outcomes: Outcome[]) => {
    const newMarketData = {
      ...marketData,
      outcomes,
    }
    setMarketdata(newMarketData)
  }

  const handleDateChange = (date: Date | null) => {
    const newMarketData = {
      ...marketData,
      resolution: date,
    }
    setMarketdata(newMarketData)
  }

  const submit = (isScalar: boolean) => {
    callback(marketData as MarketData, isScalar)
  }

  const currentStepFn = () => {
    switch (currentStep) {
      case 2:
        return (
          <FundingAndFeeStep
            back={back}
            getCompoundInterestRate={getCompoundInterestRate}
            handleChange={handleChange}
            handleCollateralChange={handleCollateralChange}
            handleTradingFeeChange={handleTradingFeeChange}
            handleUseCompoundReserveChange={handleUseCompoundReserveChange}
            marketCreationStatus={marketCreationStatus}
            resetTradingFee={resetTradingFee}
            state={currentFormState}
            submit={submit}
            values={marketData}
          />
        )
      case 1:
      default:
        return (
          <AskQuestionStep
            addArbitratorCustom={addArbitratorCustom}
            addCategoryCustom={addCategoryCustom}
            first={first}
            handleArbitratorChange={handleArbitratorChange}
            handleChange={handleChange}
            handleClearQuestion={handleClearQuestion}
            handleDateChange={handleDateChange}
            handleOutcomesChange={handleOutcomesChange}
            handleQuestionChange={handleQuestionChange}
            loadMoreButton={loadMoreButton}
            next={next}
            setFirst={setFirst}
            state={currentFormState}
            values={marketData}
          />
        )
    }
  }

  const currentMenu = () => {
    return <MenuStep currentStep={currentStep} />
  }

  return (
    <>
      {!MarketCreationStatus.is.done(marketCreationStatus) && (
        <>
          {currentMenu()} {currentStepFn()}
        </>
      )}
    </>
  )
}
