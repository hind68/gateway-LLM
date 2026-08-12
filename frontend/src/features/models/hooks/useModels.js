import { useCallback, useEffect, useState } from 'react'
import { fetchModelAliases, fetchModelDetails } from '../../../api/modelsApi'
import { LAST_MODEL_STORAGE_KEY, saveLastModel } from '../../../utils/storage'
import { cleanModelName, selectAvailableModel } from '../../../utils/modelMetadata'

/**
 * Loads model metadata while preserving the user's last selected model.
 *
 * The details endpoint is preferred because it provides display names. If it is
 * unavailable, aliases are enough to keep the selector usable. The selected
 * alias is synchronized with localStorage only after it is known to exist in
 * the loaded list, so stale saved values do not keep the UI on a missing model.
 */
export default function useModels({ activeConversation, onError, onLoaded }) {
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem(LAST_MODEL_STORAGE_KEY) || '')
  const [isLoadingModels, setIsLoadingModels] = useState(true)

  const loadModels = useCallback(async () => {
    setIsLoadingModels(true)
    try {
      const data = await fetchModelDetails()
      const normalized = Array.isArray(data)
        ? data.map((item) => ({ ...item, alias: item.alias, displayName: cleanModelName(item.displayName || item.alias, item.alias) }))
        : []
      setModels(normalized)
      setSelectedModel((current) => selectAvailableModel(normalized, current))
      onLoaded()
    } catch {
      try {
        const aliases = await fetchModelAliases()
        const normalized = Array.isArray(aliases)
          ? aliases.map((alias) => ({ alias, displayName: cleanModelName(alias, alias) }))
          : []
        setModels(normalized)
        setSelectedModel((current) => selectAvailableModel(normalized, current))
        onLoaded()
      } catch {
        onError('Impossible de charger les modèles.')
      }
    } finally {
      setIsLoadingModels(false)
    }
  }, [onError, onLoaded])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadModels()
  }, [loadModels])

  useEffect(() => {
    if (!selectedModel || !models.some((model) => model.alias === selectedModel)) return
    saveLastModel(selectedModel)
  }, [models, selectedModel])

  const activeModelAlias = activeConversation?.modelAlias || selectedModel
  const activeModel = models.find((model) => model.alias === activeModelAlias)

  const modelDisplayName = useCallback((alias) => {
    return models.find((model) => model.alias === alias)?.displayName || cleanModelName(alias, alias) || 'Modèle'
  }, [models])

  return {
    activeModel,
    activeModelAlias,
    isLoadingModels,
    modelDisplayName,
    models,
    selectedModel,
    setSelectedModel,
  }
}
