#!/usr/bin/env node

import 'core-js/stable'
import run from './run'
console.log('process.argv', process.argv)
run(process.argv)
  .catch(error => {
    console.log('\n')
    console.error(error)
    process.exit(1)
  })
