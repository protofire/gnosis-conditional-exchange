/* eslint-disable import/no-extraneous-dependencies */
import { ItemTypes, gtcrEncode } from '@kleros/gtcr-encoder'
import { abi as _GeneralizedTCR } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { ethers } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import React, { useCallback, useMemo, useState } from 'react'
import { RouteComponentProps, useHistory, withRouter } from 'react-router-dom'
import styled from 'styled-components'

import { ConnectedWeb3Context } from '../../../../hooks'
import { useKlerosCuration } from '../../../../hooks/useKlerosCuration'
import { MarketMakerData, Status } from '../../../../util/types'
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
  switchMarketTab: (arg0: string) => void
}

const MarketVerifyWrapper: React.FC<Props> = (props: Props) => {
  const { context, marketMakerData } = props || {}
  const [selection, setSelection] = useState<number | undefined>()
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const { data, error, status } = useKlerosCuration(marketMakerData, context)
  const history = useHistory()

  const selectSource = useCallback(
    (value: number) => {
      if (value === selection) {
        setSelection(undefined)
      } else setSelection(value)
    },
    [selection],
  )

  const loading = status === Status.Loading && !data
  const { ovmAddress } = data || {}
  const { message: errorMessage } = error || {}
  const { address, curatedByDxDao, question } = marketMakerData || {}
  const { title } = question || {}
  console.log(ethers)
  const ovmInstance = useMemo(() => {
    if (!context || !context.account || !ovmAddress) {
      console.log('nagrabusio')
      return
    }
    console.log(context)
    const signer = context.library.getSigner()
    setIsModalOpen(false)
    return new ethers.Contract(ovmAddress, _GeneralizedTCR, signer)
  }, [context, ovmAddress])

  const onSubmitMarket = useCallback(async () => {
    try {
      setIsModalOpen(true)
      if (!ovmInstance || !data) {
        setIsModalOpen(false)
        return
      }

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

      const transaction = await ovmInstance.addItem(encodedParams, {
        value: ethers.utils.bigNumberify(data.submissionDeposit),
      })

      await ethers.getDefaultProvider().waitForTransaction(transaction.hash)

      // await Web3Provider.waitForTransaction(transaction)
      console.log('AFTER AWIAT SKF KSJFKSJFKJSKJKJSFKJFSKJ')
      setIsModalOpen(false)
      console.log(transaction)
    } catch (e) {
      console.log(e, 'herhehrehrherhe')
      setIsModalOpen(false)
    }
  }, [address, data, ovmInstance, title])

  if (!loading && errorMessage) return <GenericError>{errorMessage || 'Failed to fetch curation data'}</GenericError>

  return (
    <MarketVerification>
      {loading || !data ? (
        <CurationRow>
          <CustomInlineLoading big message="Loading Curation Services" />
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
        <Button
          buttonType={ButtonType.primaryAlternative}
          disabled={loading || typeof selection !== 'number' || !ovmInstance}
          onClick={onSubmitMarket}
        >
          Request Verification
        </Button>
      </BottomButtonWrapper>
      {isModalOpen && <FullLoading message={'Requesting Market Removal'} />}
    </MarketVerification>
  )
}

export const MarketVerify = withRouter(MarketVerifyWrapper)
