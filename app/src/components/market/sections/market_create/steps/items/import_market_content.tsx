import React, { ChangeEvent, HTMLAttributes, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

import { ConnectedWeb3Context } from '../../../../../../contexts/connectedWeb3'
import { useAsyncDerivedValue, useContracts, useMarketMakerData } from '../../../../../../hooks'
import { useGraphMarketsFromQuestion } from '../../../../../../hooks/useGraphMarketsFromQuestion'
import { useRealityLink } from '../../../../../../hooks/useRealityLink'
import { getArbitratorFromAddress } from '../../../../../../util/networks'
import { formatDate } from '../../../../../../util/tools'
import { Arbitrator, BalanceItem, Question, Status } from '../../../../../../util/types'
import { FormRow, SimpleTextfield, Spinner, SubsectionTitle, Textfield, TitleValue } from '../../../../../common'
import { IconReality } from '../../../../../common/icons'
import {
  OutcomeItemLittleBallOfJoyAndDifferentColors,
  OutcomeItemWrapper,
  OutcomesTBody,
  OutcomesTD,
  OutcomesTH,
  OutcomesTHead,
  OutcomesTR,
  OutcomesTable,
  OutcomesTableWrapper,
  PercentWrapper,
  RowWrapper,
} from '../../../../common/common_styled'
import { DisplayArbitrator } from '../../../../common/display_arbitrator'
import { VerifiedRow } from '../../../../common/verified_row'
import { WarningMessage } from '../../../../common/warning_message'
import { Outcome } from '../outcomes'

const SubsectionTitleStyled = styled(SubsectionTitle)`
  margin-bottom: 20px;
`

const SubTitle = styled.h3`
  color: ${props => props.theme.colors.textColorDarker};
  font-size: 14px;
  line-height: 16px;
  font-weight: normal;
  margin: 0 0 8px 0;
`

const QuestionText = styled.p`
  color: ${props => props.theme.colors.textColor};
  font-size: 14px;
  line-height: 16px;
  font-weight: normal;
  margin: 0 0 20px 0;
`

const SpinnerStyled = styled(Spinner)`
  margin-bottom: 13px;
`

const ContentWrapper = styled.div`
  border: ${({ theme }) => theme.borders.borderLineDisabled};
  border-radius: 8px;
  padding: 21px 25px;
  height: 100%;
  margin-bottom: 20px;
  min-height: 300px;
`

const EmptyWrapper = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`

const CommentLabel = styled.div`
  font-size: 14px;
  line-height: 16px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textColorLighter};
  margin-top: 16px;
  & {
    a {
      color: ${({ theme }) => theme.colors.hyperlink};
    }
  }
`

const TitleValueVertical = styled(TitleValue)`
  flex-direction: column;
  justify-content: flex-start;
  text-transform: capitalize;

  > h2 {
    margin: 0 0 8px;
    line-height: 16px;
  }

  > p {
    text-align: left;
    line-height: 22px;
    margin: 0;
  }
`

const FlexRowWrapper = styled.div`
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  & > * + * {
    margin-left: 38px;
  }
`

const ResetWrapper = styled.span`
  cursor: pointer;
  font-size: 14px;
  line-height: 16px;
  color: ${({ theme }) => theme.colors.clickable};
`

const QuestionTextField = styled(Textfield)`
  border-radius: 8px;
  padding: 12px 20px;
  &:-webkit-autofill {
    -webkit-background-clip: text;
  }
`

interface Props extends HTMLAttributes<HTMLDivElement> {
  context: ConnectedWeb3Context
  loadedQuestionId: Maybe<string>
  onSave: (question: Question, arbitrator: Arbitrator, outcomes: Outcome[], verifyLabel?: string) => void
  handleClearQuestion: () => any
  handleOutcomesChange: (newOutcomes: Outcome[]) => any
  outcomes: Outcome[]
  totalProbabilities: number
}

export const ImportMarketContent = (props: Props) => {
  const { context, handleClearQuestion, handleOutcomesChange, loadedQuestionId, onSave, outcomes } = props
  const { realitio } = useContracts(context)
  const realitioBaseUrl = useRealityLink()

  const [state, setState] = useState<{ questionURL: string; loading: boolean }>({
    questionURL: loadedQuestionId ? `${realitioBaseUrl}/#!/question/${loadedQuestionId}` : '',
    loading: false,
  })

  const setQuestionURL = (value: string) => setState(prevState => ({ ...prevState, questionURL: value }))

  const setLoading = (loading: boolean) => setState(prevState => ({ ...prevState, loading }))

  const [isUniform, setUniform] = useState<boolean>(true)

  const extractId = (questionURL: string): string => {
    const reQuestionId = /question\/(0x[0-9A-Fa-f]{64})/

    if (!questionURL) return ''

    const questionMatch = questionURL.match(reQuestionId)

    return questionMatch ? questionMatch[1] : ''
  }

  const fetchQuestion = useMemo(
    () => async (): Promise<[Maybe<Question>, Maybe<Arbitrator>, Maybe<string>]> => {
      const questionId = extractId(state.questionURL)
      if (!questionId) {
        setLoading(false)
        return [null, null, null]
      }

      setLoading(true)
      try {
        const question = await realitio.getQuestion(questionId)
        const arbitrator = getArbitratorFromAddress(context.networkId, question.arbitratorAddress)
        return [question, arbitrator, null]
      } catch (err) {
        console.warn(err)
        setLoading(false)
        return [null, null, `No data found for question ID ${questionId}`]
      }
    },
    [state.questionURL, realitio, context],
  )

  const [question, arbitrator, errorMessage] = useAsyncDerivedValue('', [null, null, null], fetchQuestion)

  const { markets, status: marketIdStatus } = useGraphMarketsFromQuestion(question?.id || '')
  const marketId = markets[0]?.id || ''
  const { marketMakerData, status } = useMarketMakerData(marketId.toLowerCase())

  useEffect(() => {
    if (question && marketIdStatus === Status.Error) {
      setLoading(false)
    } else if (question && marketIdStatus === Status.Ready && !marketMakerData) {
      setLoading(false)
    } else if (question && marketMakerData && marketMakerData.question.id === question.id) {
      if (arbitrator) {
        const outcomes = marketMakerData.balances.map(
          (balance: BalanceItem) =>
            ({
              name: balance.outcomeName,
              probability: 100 / marketMakerData.balances.length,
            } as Outcome),
        )
        const verifyLabel = marketMakerData.curatedByDxDao
          ? 'DXdao'
          : marketMakerData.klerosTCRregistered
          ? 'Kleros'
          : ''
        setUniform(true)
        onSave(question, arbitrator, outcomes, verifyLabel)
      }
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketMakerData, marketIdStatus])

  const onResetMarket = () => {
    handleClearQuestion()
    setState(prevState => ({ ...prevState, questionURL: '' }))
  }

  const validContent =
    !!state.questionURL &&
    !!question &&
    !errorMessage &&
    !!marketId &&
    !!marketMakerData &&
    !state.loading &&
    status !== 'Loading'

  const questionDetails = () => {
    return (
      validContent &&
      question &&
      marketMakerData && (
        <>
          <SubsectionTitleStyled>Categorical Market</SubsectionTitleStyled>
          <div>
            <SubTitle>Question</SubTitle>
            <QuestionText>{question.title}</QuestionText>
          </div>

          <OutcomesTableWrapper borderBottom>
            <OutcomesTable>
              <OutcomesTHead>
                <OutcomesTR>
                  <OutcomesTH style={{ width: '72%' }}>Outcome</OutcomesTH>
                  <OutcomesTH>Probability</OutcomesTH>
                </OutcomesTR>
              </OutcomesTHead>
              <OutcomesTBody>
                {outcomes.map((outcome: Outcome, index: number) => {
                  return (
                    <OutcomesTR key={index}>
                      <OutcomesTD style={{ paddingRight: 12 }}>
                        <OutcomeItemWrapper readOnly>
                          <OutcomeItemLittleBallOfJoyAndDifferentColors outcomeIndex={index} />
                          <SimpleTextfield disabled style={{ flex: 1 }} type="text" value={outcome.name} />
                        </OutcomeItemWrapper>
                      </OutcomesTD>
                      <OutcomesTD>
                        <RowWrapper>
                          <OutcomeItemWrapper readOnly={false}>
                            <SimpleTextfield
                              onChange={e => {
                                const isEmpty = !e.target.value
                                if (isUniform) {
                                  setUniform(false)
                                  handleOutcomesChange(
                                    outcomes.map((tcome, tIndex) =>
                                      index !== tIndex || isEmpty
                                        ? ({ name: tcome.name } as Outcome)
                                        : { ...tcome, probability: Number(e.target.value) },
                                    ),
                                  )
                                  return
                                }
                                const newOutcomes = outcomes.map((tcome, tIndex) =>
                                  index !== tIndex
                                    ? tcome
                                    : isEmpty
                                    ? ({ name: tcome.name } as Outcome)
                                    : { ...tcome, probability: Number(e.target.value) },
                                )
                                const isNewOutcomesEmpty = newOutcomes
                                  .map(outcome => !outcome.probability)
                                  .reduce((res, element) => res && element)

                                if (isNewOutcomesEmpty) {
                                  setUniform(true)
                                  const finalOutcomes = newOutcomes.map(outcome => ({
                                    ...outcome,
                                    probability: 100 / newOutcomes.length,
                                  }))
                                  handleOutcomesChange(finalOutcomes)
                                  return
                                }

                                handleOutcomesChange(newOutcomes)
                              }}
                              placeholder={(100 / outcomes.length).toFixed(2)}
                              type="number"
                              value={isUniform ? '' : outcome.probability}
                            />
                            <PercentWrapper>%</PercentWrapper>
                          </OutcomeItemWrapper>
                        </RowWrapper>
                      </OutcomesTD>
                    </OutcomesTR>
                  )
                })}
              </OutcomesTBody>
            </OutcomesTable>
          </OutcomesTableWrapper>

          <FlexRowWrapper>
            <TitleValueVertical
              date={new Date(question.resolution)}
              title={'Closing Date (UTC)'}
              tooltip={true}
              value={formatDate(question.resolution, false)}
            />
            <TitleValueVertical title={'Category'} value={question.category} />
            {arbitrator && (
              <TitleValueVertical title={'Arbitrator'} value={<DisplayArbitrator arbitrator={arbitrator} />} />
            )}

            <TitleValueVertical
              title={'Verified by'}
              value={
                <VerifiedRow
                  label={marketMakerData.curatedByDxDao ? 'DXdao' : marketMakerData.klerosTCRregistered ? 'Kleros' : ''}
                />
              }
            />
          </FlexRowWrapper>
        </>
      )
    )
  }

  const renderContent = () => {
    if (validContent) {
      return questionDetails()
    }

    return (
      <EmptyWrapper>
        {!state.questionURL ? (
          <>
            <IconReality />
            <CommentLabel>
              Import Market from{' '}
              <a href={realitioBaseUrl} target="_blink">
                {realitioBaseUrl}
              </a>
            </CommentLabel>
          </>
        ) : !state.loading && status === 'Ready' ? (
          <CommentLabel>Market not found</CommentLabel>
        ) : (
          <>
            <SpinnerStyled size="38" />
            <CommentLabel>
              importing market from{' '}
              <a href={realitioBaseUrl} target="_blink">
                {realitioBaseUrl}
              </a>
            </CommentLabel>
          </>
        )}
      </EmptyWrapper>
    )
  }

  const renderWarning = () => {
    if (validContent && question && marketMakerData) {
      if (question.resolution <= new Date()) {
        return (
          <WarningMessage
            description={'Market has an expired closing date and cannot be imported.'}
            style={{ marginBottom: 20, marginTop: -4 }}
          />
        )
      }
      return null
    }
    return null
  }

  return (
    <>
      <FormRow
        extraTitle={validContent && <ResetWrapper onClick={onResetMarket}>Reset</ResetWrapper>}
        formField={
          <QuestionTextField
            focusOutline={false}
            name="questionURL"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const { value } = event.target
              setQuestionURL(value.trim())
            }}
            placeholder={`${realitioBaseUrl}/#!/...`}
            type="text"
            value={state.questionURL}
          />
        }
        style={{ marginTop: '20px' }}
        title={'Set Question URL'}
      />
      <ContentWrapper>{renderContent()}</ContentWrapper>
      {renderWarning()}
    </>
  )
}
