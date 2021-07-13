import { Zero } from 'ethers/constants'
import { BigNumber } from 'ethers/utils'
import React, { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useHistory } from 'react-router'
import styled, { css } from 'styled-components'

import { DOCUMENT_VALIDITY_RULES, MAX_OUTCOME_ALLOWED } from '../../../../../../common/constants'
import { useConnectedWeb3Context } from '../../../../../../contexts/connectedWeb3'
import { Arbitrator, FormState, Question } from '../../../../../../util/types'
import { Button, ButtonContainer } from '../../../../../button'
import { ButtonType } from '../../../../../button/button_styling_types'
import { DateField, FormRow, FormStateButton } from '../../../../../common'
import { BigNumberInputReturn } from '../../../../../common/form/big_number_input'
import { CommonDisabledCSS } from '../../../../../common/form/common_styled'
import { QuestionInput } from '../../../../../common/form/question_input'
import { Arbitrators } from '../../../../common/arbitrators'
import { Categories } from '../../../../common/categories'
import { MarginsButton } from '../../../../common/common_styled'
import { CreateCard } from '../../../../common/create_card'
import { WarningMessage } from '../../../../common/warning_message'
import { Outcome, Outcomes } from '../outcomes'

import { CreateScalarMarket } from './create_scalar_market'
import { ImportMarketContent } from './import_market_content'

const ButtonCategoryFocusCSS = css`
  &,
  &:hover {
    border-color: ${props => props.theme.textfield.borderColorActive};
    color: ${props => props.theme.textfield.color};
  }
`

export const ButtonCategory = styled(Button)<{ focus: boolean; isACategorySelected: boolean }>`
  max-width: 100%;
  padding-left: 10px;
  padding-right: 10px;
  width: 100%;
  &,
  &:hover {
    color: ${props =>
      props.isACategorySelected ? props.theme.colors.textColorDark : props.theme.colors.textColorLighter};
  }

  ${props => (props.focus ? ButtonCategoryFocusCSS : '')}
  ${CommonDisabledCSS}
`

ButtonCategory.defaultProps = {
  focus: false,
}

export const ButtonCategoryTextOverflow = styled.span`
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  text-transform: capitalize;
`

export const GridTwoColumns = styled.div`
  column-gap: 16px;
  display: grid;
  grid-template-columns: 1fr;
  padding-bottom: 24px;
  padding-top: 4px;
  row-gap: 20px;

  @media (min-width: ${props => props.theme.themeBreakPoints.md}) {
    grid-template-columns: 1fr 1fr;
  }
`

export const Column = styled.div``

const ButtonWithReadyToGoStatusCSS = css`
  &,
  &:hover {
    background-color: ${props => props.theme.colors.primary};
    border-color: ${props => props.theme.colors.primary};
    color: #fff;
    font-weight: 500;
  }
`

const ButtonWithReadyToGoStatus = styled(Button as any)<{ readyToGo: boolean }>`
  ${props => props.readyToGo && ButtonWithReadyToGoStatusCSS}
`

const CategoryImportWrapper = styled.div`
  border-bottom: ${({ theme }) => theme.borders.borderLineDisabled};
  margin-left: -${props => props.theme.cards.paddingHorizontal};
  margin-right: -${props => props.theme.cards.paddingHorizontal};
  padding: 0 ${props => props.theme.cards.paddingHorizontal};
  padding-bottom: 20px;
`

const LeftButton = styled(Button as any)`
  margin-right: auto;
`

const StyledButtonContainerFullWidth = styled(ButtonContainer)`
  ${MarginsButton};
  padding-top: 24px;
`

interface Props {
  next: (state: string) => void
  values: {
    question: string
    category: string
    categoriesCustom: string[]
    resolution: Date | null
    arbitrator: Arbitrator
    arbitratorsCustom: Arbitrator[]
    loadedQuestionId: Maybe<string>
    outcomes: Outcome[]
    lowerBound: Maybe<BigNumber>
    upperBound: Maybe<BigNumber>
    startingPoint: Maybe<BigNumber>
    unit: string
  }
  addArbitratorCustom: (arbitrator: Arbitrator) => void
  addCategoryCustom: (category: string) => void
  handleArbitratorChange: (arbitrator: Arbitrator) => any

  handleChange: (event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLSelectElement> | BigNumberInputReturn) => any
  handleClearQuestion: () => any
  handleDateChange: (date: Date | null) => any
  handleOutcomesChange: (newOutcomes: Outcome[]) => any
  handleQuestionChange: (question: Question, arbitrator: Arbitrator, outcomes: Outcome[], verifyLabel?: string) => any
  setFirst: React.Dispatch<React.SetStateAction<number>>
  first: number
  loadMoreButton: boolean
  state: string
}

const AskQuestionStep = (props: Props) => {
  const context = useConnectedWeb3Context()

  const {
    first,
    handleArbitratorChange,
    handleChange,
    handleClearQuestion,
    handleDateChange,
    handleOutcomesChange,
    handleQuestionChange,
    loadMoreButton,
    setFirst,
    state,
    values,
  } = props

  const {
    arbitrator,
    arbitratorsCustom,
    categoriesCustom,
    category,
    loadedQuestionId,
    lowerBound,
    outcomes,
    question,
    resolution,
    startingPoint,
    unit,
    upperBound,
  } = values

  const history = useHistory()

  const [currentFormState, setCurrentFormState] = useState(
    state ? state : loadedQuestionId ? FormState.import : FormState.categorical,
  )

  const totalProbabilities = outcomes.reduce((total, cur) => total + (cur.probability ? cur.probability : 0), 0)
  const totalProbabilitiesNotFull = Math.abs(totalProbabilities - 100) > 0.000001
  const outcomeNames = outcomes.map(outcome => outcome.name)

  const [isContinueButtonDisabled, setIsContinueButtonDisabled] = useState(true)

  const isProperScale =
    lowerBound && startingPoint && upperBound && lowerBound?.lte(startingPoint) && startingPoint?.lte(upperBound)

  useEffect(() => {
    if (currentFormState === FormState.categorical || currentFormState === FormState.import) {
      setIsContinueButtonDisabled(
        totalProbabilitiesNotFull ||
          outcomes.length < 2 ||
          !question ||
          !resolution ||
          resolution < new Date() ||
          !category ||
          outcomeNames.map(name => !name).reduce((e1, e2) => e1 || e2) ||
          outcomeNames.map((name, index) => outcomeNames.indexOf(name) !== index).reduce((e1, e2) => e1 || e2),
      )
    } else if (currentFormState === FormState.scalar) {
      setIsContinueButtonDisabled(
        !question ||
          !lowerBound ||
          !upperBound ||
          !startingPoint ||
          !unit ||
          !resolution ||
          resolution < new Date() ||
          !category ||
          !isProperScale ||
          lowerBound.gte(startingPoint) ||
          startingPoint.gte(upperBound) ||
          lowerBound.lt(Zero),
      )
    }
  }, [
    category,
    currentFormState,
    isProperScale,
    lowerBound,
    outcomeNames,
    outcomes.length,
    question,
    resolution,
    startingPoint,
    totalProbabilitiesNotFull,
    unit,
    upperBound,
  ])

  const canAddOutcome = outcomes.length < MAX_OUTCOME_ALLOWED && !loadedQuestionId

  const [categoryButtonFocus, setCategoryButtonFocus] = useState(false)

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const firstMount = useRef(true)
  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false
      return
    }
    handleClearQuestion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFormState === FormState.import])

  const toggleCategoryButtonFocus = useCallback(() => {
    setCategoryButtonFocus(!categoryButtonFocus)
  }, [categoryButtonFocus])

  const handleCategoryChange = (e: any) => {
    setCategoryButtonFocus(false)
    handleChange(e)
  }

  return (
    <CreateCard style={{ paddingTop: 20, paddingBottom: 20 }}>
      <CategoryImportWrapper>
        <FormStateButton
          active={currentFormState === FormState.categorical}
          onClick={() => setCurrentFormState(FormState.categorical)}
        >
          Categorical Market
        </FormStateButton>
        <FormStateButton
          active={currentFormState === FormState.scalar}
          onClick={() => setCurrentFormState(FormState.scalar)}
        >
          Scalar Market
        </FormStateButton>
        <FormStateButton
          active={currentFormState === FormState.import}
          onClick={() => {
            setCurrentFormState(FormState.import)
          }}
        >
          Import Market
        </FormStateButton>
      </CategoryImportWrapper>
      {currentFormState === FormState.import ? (
        <ImportMarketContent
          context={context}
          handleClearQuestion={handleClearQuestion}
          handleOutcomesChange={handleOutcomesChange}
          loadedQuestionId={loadedQuestionId}
          onSave={handleQuestionChange}
          outcomes={outcomes}
          totalProbabilities={totalProbabilities}
        ></ImportMarketContent>
      ) : currentFormState === FormState.scalar ? (
        <CreateScalarMarket
          arbitrator={arbitrator}
          arbitratorsCustom={arbitratorsCustom}
          categoriesCustom={categoriesCustom}
          category={category}
          categoryButtonFocus={categoryButtonFocus}
          context={context}
          first={first}
          handleArbitratorChange={handleArbitratorChange}
          handleCategoryChange={handleCategoryChange}
          handleChange={handleChange}
          handleDateChange={handleDateChange}
          loadMoreButton={loadMoreButton}
          lowerBound={lowerBound}
          question={question}
          resolution={resolution}
          setFirst={setFirst}
          startingPoint={startingPoint}
          toggleCategoryButtonFocus={toggleCategoryButtonFocus}
          tomorrow={tomorrow}
          unit={unit}
          upperBound={upperBound}
        />
      ) : (
        <>
          <FormRow
            formField={
              <QuestionInput
                context={context}
                disabled={!!loadedQuestionId}
                name="question"
                onChange={handleChange}
                placeholder="What would you like to see the world predict?"
                value={question}
              />
            }
          />
          <Outcomes
            canAddOutcome={canAddOutcome}
            disabled={!!loadedQuestionId}
            onChange={handleOutcomesChange}
            outcomes={outcomes}
            totalProbabilities={totalProbabilities}
          />
          <GridTwoColumns>
            <Column>
              <FormRow
                formField={
                  <DateField
                    disabled={!!loadedQuestionId}
                    minDate={tomorrow}
                    name="resolution"
                    networkId={context.networkId}
                    onChange={handleDateChange}
                    placeholder="Select closing date"
                    selected={resolution}
                  />
                }
                title={'Closing Date - UTC'}
              />
            </Column>
            <Column>
              <FormRow
                formField={
                  <ButtonCategory
                    buttonType={ButtonType.secondaryLine}
                    disabled={!!loadedQuestionId}
                    focus={categoryButtonFocus}
                    isACategorySelected={category !== ''}
                    onClick={toggleCategoryButtonFocus}
                  >
                    <ButtonCategoryTextOverflow>{category ? category : 'Select category'}</ButtonCategoryTextOverflow>
                  </ButtonCategory>
                }
                title={'Category'}
              />
            </Column>
          </GridTwoColumns>
          {categoryButtonFocus && (
            <Categories
              categories={categoriesCustom}
              first={first}
              loadMoreButton={loadMoreButton}
              name="category"
              onChange={handleCategoryChange}
              selectedCategory={category.toLowerCase()}
              setFirst={setFirst}
            />
          )}
          <WarningMessage
            additionalDescription={'.'}
            description={
              "Set the market closing date at least 6 days after the correct outcome will be known and make sure that this market won't be "
            }
            href={DOCUMENT_VALIDITY_RULES}
            hyperlinkDescription={'invalid'}
            style={{ marginBottom: 0 }}
          />
          <FormRow
            formField={
              <Arbitrators
                customValues={arbitratorsCustom}
                disabled={!!loadedQuestionId}
                networkId={context.networkId}
                onChangeArbitrator={handleArbitratorChange}
                value={arbitrator}
              />
            }
            style={{ marginBottom: 0, marginTop: 24 }}
            title={'Arbitrator'}
          />
        </>
      )}

      <StyledButtonContainerFullWidth borderTop={true}>
        <LeftButton buttonType={ButtonType.secondaryLine} onClick={() => history.push(`/`)}>
          Cancel
        </LeftButton>
        <ButtonWithReadyToGoStatus
          buttonType={ButtonType.secondaryLine}
          disabled={isContinueButtonDisabled}
          onClick={() => props.next(currentFormState)}
          readyToGo={!isContinueButtonDisabled}
        >
          Continue
        </ButtonWithReadyToGoStatus>
      </StyledButtonContainerFullWidth>
    </CreateCard>
  )
}

export { AskQuestionStep }
