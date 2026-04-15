export interface AppRefreshContext {
    source: 'header' | 'chat-inspect-settings'
    routePath: string
}

type AppRefreshHandler = (
    context: AppRefreshContext,
) => void | Promise<void>

const refreshHandlers = new Set<AppRefreshHandler>()

export const subscribeAppRefresh = (handler: AppRefreshHandler) => {
    refreshHandlers.add(handler)
    return () => {
        refreshHandlers.delete(handler)
    }
}

export const emitAppRefresh = async (context: AppRefreshContext) => {
    await Promise.allSettled(
        Array.from(refreshHandlers).map((handler) =>
            Promise.resolve(handler(context)),
        ),
    )
}