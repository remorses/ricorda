# persistorm

```
npm i persistorm
```

# Usage

```tsx
import FormPersistence from 'persistorm'

function MyForm() {
    return (
        <form
            ref={(form) => {
                const cleanup = FormPersistence.persist(form)
                return cleanup
            }}
            id='myForm'
        >
            <input type='text' name='username' placeholder='Enter username' />
            <button type='submit'>Submit</button>
        </form>
    )
}
```
