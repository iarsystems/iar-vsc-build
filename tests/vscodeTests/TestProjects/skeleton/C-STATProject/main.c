#include "stdio.h"
#include <DLib_Threads.h>

// This is a comment

int global;

int *bad_fun() {
    return 0;
}


int main()
{
    int local = 0;
    int sum = 0;
    sum = addOne(sum);

    printf("sum = %d local = %d\n",sum,local);

    int a = 0;
    //cstat -MISRAC*
    if (a) { a = *bad_fun(); }
    //cstat +MISRAC*
    char arr[4];
    arr[4] = a;
}
