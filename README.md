# howfastami

A simple React app that shows users how many countries' national records in track and field they are faster than.

[https://howfastami.netlify.app](https://howfastami.netlify.app)

e.g., entering a time of 15:40 for the 5,000 meters returns "you are faster than the runners of 20 countries..." and lists them.


## Grabbing the data (do this prior to local dev, or there won't be anything to compare to)

```
$ npm install
$ npm run getData
```

## Local developlment

```
$ npm start
```
...updates the datetime in the json array for display on the site


## Building for deployment (for example, on Netlify)

```
$ npm run build
```

### the old angularJS app

This involved a database and other backendy stuff, so have moved it to the `legacy`
tag if anyone is curious.
