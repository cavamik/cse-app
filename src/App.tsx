import { CantiereForm } from './components/CantiereForm'
import { CantiereSelector } from './components/CantiereSelector'
import { VerbaleWizard } from './components/VerbaleWizard'
import { AppProvider, useApp } from './state/AppContext'

function Shell() {
  const { view } = useApp()
  if (view.name === 'cantiere') return <CantiereForm key={view.cantiereId ?? 'new'} />
  if (view.name === 'wizard') return <VerbaleWizard />
  return <CantiereSelector />
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
