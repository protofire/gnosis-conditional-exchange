import { configureStore } from '@reduxjs/toolkit'
import React, { useEffect, useState } from 'react'
import { Provider } from 'react-redux'
import Web3Provider from 'web3-react'

import 'react-datepicker/dist/react-datepicker.css'
import 'sanitize.css'

import { HeaderNoRouter } from './components/common/layout/header'
import { Main } from './components/main'
import SettingsViewContainer from './components/settings/settings_view'
import { ApolloProviderWrapper } from './contexts/Apollo'
import { ConnectedWeb3 } from './hooks'
import balanceReducer from './store/reducer'
import { ThemeProvider } from './theme'
import { GlobalStyle } from './theme/global_style'
import connectors from './util/connectors'
import { getInfuraUrl } from './util/networks'
import { checkRpcStatus, getNetworkFromChain } from './util/tools'

const store = configureStore({ reducer: balanceReducer })

const App: React.FC = () => {
  const windowObj: any = window

  const ethereum = windowObj.ethereum
  const networkId = ethereum && ethereum.chainId
  const [status, setStatus] = useState(true)
  const network = getNetworkFromChain(networkId)

  useEffect(() => {
    if (network && network !== -1) checkRpcStatus(getInfuraUrl(network), setStatus, network)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ethereum])

  return (
    <ThemeProvider>
      <Web3Provider connectors={connectors} libraryName="ethers.js">
        {!status ? (
          <>
            <HeaderNoRouter />
            <SettingsViewContainer networkId={networkId} />
          </>
        ) : (
          <ConnectedWeb3 setStatus={setStatus}>
            <ApolloProviderWrapper>
              <Provider store={store}>
                <GlobalStyle />
                <Main />
              </Provider>
            </ApolloProviderWrapper>
          </ConnectedWeb3>
        )}
      </Web3Provider>
    </ThemeProvider>
  )
}

export default App
