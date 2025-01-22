# ricorda

```
npm i ricorda
```

# Usage

```tsx
import { persistForm } from 'ricorda'

function MyForm() {
    return (
        <form
            ref={(form) => {
                const cleanup = persistForm(form)
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
