/* eslint-disable import/no-extraneous-dependencies */
import { ItemTypes, gtcrEncode } from '@kleros/gtcr-encoder'
import React, { useCallback, useEffect, useState } from 'react'
import { RouteComponentProps, useHistory, withRouter } from 'react-router-dom'
import styled from 'styled-components'

import { ConnectedWeb3Context } from '../../../../hooks'
import { useKlerosCuration } from '../../../../hooks/useKlerosCuration'
import { MarketDetailsTab, MarketMakerData, Status } from '../../../../util/types'
import { Button, ButtonContainer } from '../../../button'
import { ButtonType } from '../../../button/button_styling_types'
import { FullLoading, InlineLoading } from '../../../loading'
import { CurationRow, GenericError } from '../../common/common_styled'

import { DxDaoCuration } from './option/dxdao_curation'
import { KlerosCuration } from './option/kleros_curation'

const CustomInlineLoading = styled(InlineLoading)`
  margin: 24px 0 35px;
`

const BottomButtonWrapper = styled(ButtonContainer)`
  justify-content: space-between;
`

const MarketVerification = styled.div`
  margin: 0 -25px;
  padding: 0 24px 0;
  border-top: ${({ theme }) => theme.borders.borderLineDisabled};
`

interface Props extends RouteComponentProps<any> {
  context: ConnectedWeb3Context
  marketMakerData: MarketMakerData
  switchMarketTab: (arg0: MarketDetailsTab) => void
  fetchGraphMarketMakerData: () => Promise<void>
}

const MarketVerifyWrapper: React.FC<Props> = (props: Props) => {
  const { context, fetchGraphMarketMakerData, marketMakerData } = props || {}
  const [selection, setSelection] = useState<number | undefined>()
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const { data, error, status, syncAndRefetchData } = useKlerosCuration(
    marketMakerData,
    context,
    fetchGraphMarketMakerData,
  )

  const history = useHistory()
  const cpk = context.cpk

  const selectSource = useCallback(
    (value: number) => {
      if (value === selection) {
        setSelection(undefined)
      } else setSelection(value)
    },
    [selection],
  )

  const loading = status === Status.Loading && !data
  const { marketVerificationData, ovmAddress } = data || {}
  const verificationState = marketVerificationData ? marketVerificationData.verificationState : false
  const { message: errorMessage } = error || {}
  const { address, curatedByDxDao, question } = marketMakerData || {}
  const { title } = question || {}
  useEffect(() => {
    if (isModalOpen && verificationState != 1) setIsModalOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketVerificationData])
  const onSubmitMarket = useCallback(async () => {
    try {
      setIsModalOpen(true)

      const columns = [
        {
          label: 'Question',
          type: ItemTypes.TEXT,
        },
        {
          label: 'Market URL',
          type: ItemTypes.LINK,
        },
      ]
      const values = {
        Question: title,
        'Market URL': `https://omen.eth.link/#/${address}`,
      }

      const encodedParams = gtcrEncode({ columns, values })
      if (!cpk || !marketMakerData || !data || !ovmAddress) {
        setIsModalOpen(false)
        return
      }

      const transaction = await cpk.requestVerification({
        params: encodedParams,
        submissionDeposit: data.submissionDeposit,
        ovmAddress,
      })

      if (transaction.blockNumber) {
        await syncAndRefetchData(transaction.blockNumber)
      }

      setIsModalOpen(false)
    } catch {
      setIsModalOpen(false)
    }
  }, [address, data, ovmAddress, title, marketMakerData, cpk, syncAndRefetchData])

  if (!loading && errorMessage) return <GenericError>{errorMessage || 'Failed to fetch curation data'}</GenericError>

  const verificationBtnDisabled =
    loading || typeof selection !== 'number' || !ovmAddress || verificationState != 1 || cpk?.isSafeApp
  return (
    <MarketVerification>
      {loading || !data ? (
        <CurationRow>
          <CustomInlineLoading message="Loading Curation Services" />
        </CurationRow>
      ) : (
        <>
          <KlerosCuration klerosCurationData={data} option={selection} selectSource={selectSource} />
          <DxDaoCuration curatedByDxDao={curatedByDxDao} option={selection} selectSource={selectSource} />
        </>
      )}
      <BottomButtonWrapper>
        <Button buttonType={ButtonType.secondaryLine} onClick={() => history.goBack()}>
          Back
        </Button>
        <Button buttonType={ButtonType.primary} disabled={verificationBtnDisabled} onClick={onSubmitMarket}>
          Request Verification
        </Button>
      </BottomButtonWrapper>
      {isModalOpen && <FullLoading message={`Requesting ${selection === 0 ? `Kleros` : `DxDao`} verification`} />}
    </MarketVerification>
  )
}

export const MarketVerify = withRouter(MarketVerifyWrapper)
