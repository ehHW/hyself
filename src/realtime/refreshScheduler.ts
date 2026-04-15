export function createRealtimeRefreshScheduler(options: {
    delayMs: number
    shouldRun: () => boolean
    run: () => Promise<void>
}) {
    let timer: ReturnType<typeof setTimeout> | null = null
    let running = false
    let queuedWhileRunning = false

    const clearTimer = () => {
        if (!timer) {
            return
        }
        clearTimeout(timer)
        timer = null
    }

    const execute = async () => {
        clearTimer()
        if (!options.shouldRun()) {
            queuedWhileRunning = false
            return
        }
        if (running) {
            queuedWhileRunning = true
            return
        }
        running = true
        try {
            await options.run()
        } finally {
            running = false
            if (queuedWhileRunning) {
                queuedWhileRunning = false
                schedule()
            }
        }
    }

    const schedule = () => {
        if (!options.shouldRun()) {
            clearTimer()
            queuedWhileRunning = false
            return
        }
        if (running) {
            queuedWhileRunning = true
            return
        }
        clearTimer()
        timer = setTimeout(() => {
            void execute()
        }, options.delayMs)
    }

    const dispose = () => {
        clearTimer()
        queuedWhileRunning = false
    }

    return {
        schedule,
        dispose,
    }
}