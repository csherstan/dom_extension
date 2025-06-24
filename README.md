The goal of this project is to create a chrome browser extension.
The purpose of the extension is to allow users to customize how a page is rendered through the use of CSS.

- The extension presents the user with a chat box and lets the user describe how they want to change the page.
- This information is then sent to a server which uses a large language model to generate the CSS.
- The LLM runs locally using ollama.
- The extension then injects the css.
- If the user is satisfied with the result, they can save the CSS to a file locally. The next time they visit the page, 
the extension will automatically inject the saved CSS.
- If the user is not satisfied, they can continue to refine the CSS by chatting with the LLM, which should remove the 
previously injected CSS and inject the new CSS.
- When loading a saved css file, the url matching should be flexible so that we can specify wildcards in the url.