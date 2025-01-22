interface FormPersistenceOptions {
    uuid?: string | null
    useSessionStorage?: boolean
    saveOnSubmit?: boolean
    valueFunctions?: Record<string, (form: HTMLFormElement, value: any) => void>
    include?: string[]
    exclude?: string[]
    includeFilter?: (element: Element) => boolean
    excludeFilter?: (element: Element) => boolean
}

interface FormData {
    [key: string]: any[]
}

const FormPersistence = (function () {
    function persist(
        form: HTMLFormElement,
        options: FormPersistenceOptions = {},
    ) {
        const config = {
            saveOnSubmit: false,
            ...options,
        }

        load(form, config)

        const saveForm = () => save(form, config)
        const saveFormBeforeUnload = () => {
            window.removeEventListener('unload', saveForm)
            saveForm()
        }

        // Add popstate listener for SPA navigation
        window.addEventListener('popstate', saveForm)
        // Keep the unload listeners for actual page leaves/refreshes
        window.addEventListener('beforeunload', saveFormBeforeUnload)
        window.addEventListener('unload', saveForm)

        if (!config.saveOnSubmit) {
            form.addEventListener('submit', () => {
                window.removeEventListener('popstate', saveForm)
                window.removeEventListener('beforeunload', saveFormBeforeUnload)
                window.removeEventListener('unload', saveForm)
                clearStorage(form, config)
            })
        }

        // Return both cleanup and save functions
        return () => {
            saveForm()
            window.removeEventListener('popstate', saveForm)
            window.removeEventListener('beforeunload', saveFormBeforeUnload)
            window.removeEventListener('unload', saveForm)
        }
    }

    function serialize(
        form: HTMLFormElement,
        options: FormPersistenceOptions = {},
    ): FormData {
        const config = {
            include: [],
            exclude: [],
            includeFilter: null,
            excludeFilter: null,
            ...options,
        }

        const data: FormData = {}

        for (const element of Array.from(form.elements)) {
            const tag = element.tagName
            const type = (element as HTMLInputElement).type

            if (tag === 'INPUT' && (type === 'password' || type === 'file')) {
                continue
            }

            if (
                isNameFiltered(
                    (element as HTMLInputElement).name,
                    config.include,
                    config.exclude,
                ) ||
                isElementFiltered(
                    element,
                    config.includeFilter,
                    config.excludeFilter,
                )
            ) {
                continue
            }

            if (tag === 'INPUT') {
                const input = element as HTMLInputElement
                if (type === 'radio') {
                    if (input.checked) {
                        pushToArray(data, input.name, input.value)
                    }
                } else if (type === 'checkbox') {
                    pushToArray(data, input.name, input.checked)
                } else {
                    pushToArray(data, input.name, input.value)
                }
            } else if (tag === 'TEXTAREA') {
                const textarea = element as HTMLTextAreaElement
                pushToArray(data, textarea.name, textarea.value)
            } else if (tag === 'SELECT') {
                const select = element as HTMLSelectElement
                if (select.multiple) {
                    for (const option of Array.from(select.options)) {
                        if (option.selected) {
                            pushToArray(data, select.name, option.value)
                        }
                    }
                } else {
                    pushToArray(data, select.name, select.value)
                }
            }
        }
        return data
    }

    function pushToArray(dict: FormData, key: string, value: any) {
        if (value === '') return

        if (!(key in dict)) {
            dict[key] = []
        }
        dict[key].push(value)
    }

    function isNameFiltered(
        name: string,
        include: string[] = [],
        exclude: string[] = [],
    ): boolean {
        if (!name) return true
        if (exclude.includes(name)) return true
        if (include.length > 0 && !include.includes(name)) return true
        return false
    }

    function isElementFiltered(
        element: Element,
        includeFilter: ((element: Element) => boolean) | null,
        excludeFilter: ((element: Element) => boolean) | null,
    ): boolean {
        if (excludeFilter && excludeFilter(element)) return true
        if (includeFilter && !includeFilter(element)) return true
        return false
    }

    function save(form: HTMLFormElement, options: FormPersistenceOptions = {}) {
        const config = {
            uuid: null,
            useSessionStorage: false,
            ...options,
        }

        const data = serialize(form, config)
        const storage = config.useSessionStorage ? sessionStorage : localStorage
        storage.setItem(getStorageKey(form, config.uuid), JSON.stringify(data))
    }

    function deserialize(
        form: HTMLFormElement,
        data: FormData,
        options: FormPersistenceOptions = {},
    ) {
        const config = {
            valueFunctions: null,
            include: [],
            exclude: [],
            includeFilter: null,
            excludeFilter: null,
            ...options,
        }

        const speciallyHandled = config.valueFunctions
            ? applySpecialHandlers(data, form, config.valueFunctions!)
            : []

        for (const name in data) {
            if (isNameFiltered(name, config.include, config.exclude)) {
                continue
            }

            if (!speciallyHandled.includes(name)) {
                const inputs = Array.from(form.elements).filter(
                    (element) =>
                        (element as HTMLInputElement).name === name &&
                        !isElementFiltered(
                            element,
                            config.includeFilter,
                            config.excludeFilter,
                        ),
                )
                inputs.forEach((input, i) => {
                    applyValues(input, data[name], i)
                })
            }
        }
    }

    function load(form: HTMLFormElement, options: FormPersistenceOptions = {}) {
        const config = {
            uuid: null,
            useSessionStorage: false,
            ...options,
        }

        const storage = config.useSessionStorage ? sessionStorage : localStorage
        const json = storage.getItem(getStorageKey(form, config.uuid))

        if (json) {
            const data = JSON.parse(json)
            deserialize(form, data, options)
        }
    }

    function clearStorage(
        form: HTMLFormElement,
        options: FormPersistenceOptions = {},
    ) {
        const config = {
            uuid: null,
            useSessionStorage: false,
            ...options,
        }

        const storage = config.useSessionStorage ? sessionStorage : localStorage
        storage.removeItem(getStorageKey(form, config.uuid))
    }

    function applyValues(element: Element, values: any[], index: number) {
        const tag = element.tagName

        if (tag === 'INPUT') {
            const input = element as HTMLInputElement
            const type = input.type

            if (type === 'radio') {
                input.checked = input.value === values[0]
            } else if (type === 'checkbox') {
                input.checked = values[index]
            } else {
                input.value = values[index]
            }
        } else if (tag === 'TEXTAREA') {
            ;(element as HTMLTextAreaElement).value = values[index]
        } else if (tag === 'SELECT') {
            const select = element as HTMLSelectElement
            if (select.multiple) {
                for (const option of Array.from(select.options)) {
                    option.selected = values.includes(option.value)
                }
            } else {
                select.value = values[index]
            }
        }
    }

    function applySpecialHandlers(
        data: FormData,
        form: HTMLFormElement,
        options: FormPersistenceOptions,
    ): string[] {
        const speciallyHandled: string[] = []

        if (!options.valueFunctions) return speciallyHandled

        for (const fnName in options.valueFunctions) {
            if (fnName in data) {
                if (isNameFiltered(fnName, options.include, options.exclude)) {
                    continue
                }
                for (const value of data[fnName]) {
                    options.valueFunctions[fnName](form, value)
                }
                speciallyHandled.push(fnName)
            }
        }
        return speciallyHandled
    }

    function getStorageKey(form: HTMLFormElement, uuid: string | null): string {
        if (!uuid && !form.id) {
            throw Error('form persistence requires a form id or uuid')
        }
        return 'form#' + (uuid ? uuid : form.id)
    }

    return {
        persist,
        load,
        save,
        clearStorage,
        serialize,
        deserialize,
    }
})()

export default FormPersistence
