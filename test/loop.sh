#!/bin/bash
counter=0
while [ $? -eq 0 ]
do
((++counter))
echo $(date) 'Pass ==================' $counter
npm test >/dev/shm/test-pass.log 2>/dev/shm/test-error.log
done
