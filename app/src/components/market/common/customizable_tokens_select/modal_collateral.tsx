import React, { ChangeEvent, HTMLAttributes, useState } from 'react'
import styled from 'styled-components'

import { ConnectedWeb3Context } from '../../../../contexts/connectedWeb3'
import { useCollateral } from '../../../../hooks'
import { Token } from '../../../../util/types'
import { Button } from '../../../button'
import { ButtonType } from '../../../button/button_styling_types'
import { FormRow, Spinner, SubsectionTitle, Textfield, TitleValue } from '../../../common'
import { ModalWrapper } from '../../../modal/modal_wrapper'

const Grid = styled.div`
  column-gap: 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
`

const ButtonStyled = styled(Button)`
  margin-top: 80px;
`

const SubsectionTitleStyled = styled(SubsectionTitle)`
  font-size: 15px;
`

const TitleValueStyled = styled(TitleValue)`
  display: flex;

  > p {
    margin-left: 5px;
  }
`

const SpinnerStyled = styled(Spinner)`
  margin-left: 136px;
  margin-top: 50px;
`

interface Props extends HTMLAttributes<HTMLDivElement> {
  context: ConnectedWeb3Context
  isOpen: boolean
  onClose: () => void
  onSave: (collateral: Token) => void
}

export const ModalCollateral = (props: Props) => {
  const { context, isOpen, onClose, onSave } = props
  const [collateralAddress, setCollateralAddress] = useState<string>('')
  const { collateral, errorMessage, isSpinnerOn } = useCollateral(collateralAddress, context)

  const validCollateralAddress: Maybe<Token> = collateral ? { ...collateral } : null

  const onClickSaveButton = () => {
    if (validCollateralAddress) {
      onSave(validCollateralAddress)
      onClose()
    }
  }

  const spinner = () => {
    return isSpinnerOn && <SpinnerStyled size="25" />
  }

  const tokenDetails = () => {
    return (
      validCollateralAddress && (
        <>
          <SubsectionTitleStyled>Details</SubsectionTitleStyled>
          <Grid>
            <TitleValueStyled title={'Symbol:'} value={validCollateralAddress && validCollateralAddress.symbol} />
            <TitleValueStyled title={'Decimals:'} value={validCollateralAddress && validCollateralAddress.decimals} />
          </Grid>
        </>
      )
    )
  }

  return (
    <ModalWrapper isOpen={isOpen} onRequestClose={onClose} title={`Add custom token`}>
      <FormRow
        error={errorMessage || ''}
        formField={
          <Textfield
            hasError={errorMessage ? true : false}
            hasSuccess={validCollateralAddress ? true : false}
            name="collateralAddress"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const { value } = event.target
              setCollateralAddress(value.trim())
            }}
            placeholder="0xac5d29e67a53ee4903d59a4c929b718e1d575eee"
            type="text"
          />
        }
        title={'Collateral Token Address'}
      />
      {tokenDetails()}
      {spinner()}
      <ButtonStyled buttonType={ButtonType.primary} disabled={!validCollateralAddress} onClick={onClickSaveButton}>
        Add
      </ButtonStyled>
    </ModalWrapper>
  )
}
