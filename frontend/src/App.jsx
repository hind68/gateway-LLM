import { useCallback, useRef, useState, useContext } from 'react'
import { flushSync } from 'react-dom'
import { AuthContext } from './AuthProvider'
import useConversations from './features/conversations/hooks/useConversations'
import AppLayout from './features/layout/AppLayout'
import useAppMenus from './features/layout/hooks/useAppMenus'
import useChatController from './features/chat/hooks/useChatController'
import useChatUi from './features/chat/hooks/useChatUi'
import useModels from './features/models/hooks/useModels'
import { hasAdminRole } from './utils/authUtils'

function App() {
  const keycloak = useContext(AuthContext)
  const token = keycloak?.token

  const [notifications, setNotifications] = useState([])
  const notificationIdRef = useRef(0)
  const [showTabs, setShowTabs] = useState(false)
  const isAdmin = hasAdminRole(token)
  const [showAdminDashboard, setShowAdminDashboardState] = useState(false)

  const setShowAdminDashboard = useCallback((nextValue) => {
    const currentValue = showAdminDashboard
    const resolvedValue = typeof nextValue === 'function' ? nextValue(currentValue) : nextValue
    const updateView = () => {
      flushSync(() => {
        setShowAdminDashboardState(resolvedValue)
      })
    }

    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      updateView()
      return
    }

    document.documentElement.dataset.workspaceTransition = resolvedValue ? 'to-admin' : 'to-chat'
    const transition = document.startViewTransition(updateView)
    const clearTransitionDirection = () => {
      delete document.documentElement.dataset.workspaceTransition
    }
    transition.finished.then(clearTransitionDirection, clearTransitionDirection)
  }, [showAdminDashboard])

  const showError = useCallback((message) => {
    notificationIdRef.current += 1
    setNotifications((current) => [...current, { id: notificationIdRef.current, kind: 'error', message }])
  }, [])

  const showNotice = useCallback((message) => {
    notificationIdRef.current += 1
    setNotifications((current) => [...current, { id: notificationIdRef.current, kind: 'success', message }])
  }, [])

  const clearChatError = useCallback(() => {
    setNotifications((current) => current.filter((notification) => notification.kind !== 'error'))
  }, [])

  const clearFeedback = useCallback(() => {
    setNotifications([])
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id))
  }, [])

  const menus = useAppMenus({
    onEscape: () => {
      clearFeedback()
    },
  })

  const models = useModels({
    activeConversation: null,
    onError: showError,
    onLoaded: clearChatError,
  })

  const conversations = useConversations({
    selectedModel: models.selectedModel,
    setSelectedModel: models.setSelectedModel,
    navigation: {
      closeSidePanelOnMobile: menus.closeSidePanelOnMobile,
      closeTransientMenus: menus.closeTransientMenus,
      setActiveView: menus.setActiveView,
      setIsModelMenuOpen: menus.setIsModelMenuOpen,
    },
    feedback: {
      clearChatError,
      showError,
      showNotice,
    },
  })

  const chat = useChatUi({
    activeConversationIdRef: conversations.status.activeConversationIdRef,
    activeModelAlias: models.activeModelAlias,
    isGenerating: conversations.status.isGenerating,
    loadConversations: conversations.actions.loadConversations,
    modelDisplayName: models.modelDisplayName,
    setConversationUiStatus: conversations.status.setConversationUiStatus,
    showError,
    showNotice,
  })

  const controller = useChatController({
    chat,
    conversations,
    models,
    navigation: {
      closeSidePanelOnMobile: menus.closeSidePanelOnMobile,
      setIsModelMenuOpen: menus.setIsModelMenuOpen,
    },
    feedback: {
      clearChatError,
      showError,
    },
  })

  const conversationProps = {
    ...conversations,
    actions: {
      ...conversations.actions,
      ...controller,
    },
  }

  return (
    <AppLayout
      layout={{
        closeSidebarPanels: menus.closeSidebarPanels,
        closeTransientMenus: menus.closeTransientMenus,
        collapsedPanel: menus.collapsedPanel,
        isAccountMenuOpen: menus.isAccountMenuOpen,
        isHeaderMenuOpen: menus.isHeaderMenuOpen,
        isModelMenuOpen: menus.isModelMenuOpen,
        isModelsView: menus.isModelsView,
        isSearchModalOpen: menus.isSearchModalOpen,
        isSidebarOpen: menus.isSidebarOpen,
        openMenuId: menus.openMenuId,
        searchInputRef: menus.searchInputRef,
        setActiveView: menus.setActiveView,
        setCollapsedPanel: menus.setCollapsedPanel,
        setIsAccountMenuOpen: menus.setIsAccountMenuOpen,
        setIsHeaderMenuOpen: menus.setIsHeaderMenuOpen,
        setIsModelMenuOpen: menus.setIsModelMenuOpen,
        setIsSearchModalOpen: menus.setIsSearchModalOpen,
        setIsSidebarOpen: menus.setIsSidebarOpen,
        setOpenMenuId: menus.setOpenMenuId,
        toggleCollapsedPanel: menus.toggleCollapsedPanel,
        toggleSidebar: menus.toggleSidebar,
      }}
      sidebar={{
        showTabs,
        setShowTabs,
      }}
      chat={chat}
      models={models}
      conversations={conversationProps}
      feedback={{
        notifications,
        onDismissNotification: dismissNotification,
      }}
      admin={{
        isAdmin,
        showAdminDashboard,
        setShowAdminDashboard,
        onError: showError,
        onNotice: showNotice,
        onModelsChanged: models.refreshModels,
      }}
    />
  )
}

export default App
