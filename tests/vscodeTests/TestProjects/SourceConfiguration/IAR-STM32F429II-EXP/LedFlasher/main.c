/*******************************************************************************
 *      (c) Copyright IAR System 2013
 *
 *      File name   : main.c
 *      Description : Initializes hardware and runs the example.
 *
 *      History :
 *      1. Date        : 9, July 2013
 *         Author      : Stefan Risberg
 *         Description : Create
 *      2. Date        : 13, September 2013
 *         Author      : Stefan Risberg
 *         Description : Made code easier for fast port to other chip
 *                       configurations.
 *
 *      $Revision: 9829 $
 ******************************************************************************/

#include "main.h"
#include "config.h"
#include "intrinsics.h"

void main()
{
    SystemInit();
    /* Set the Vector Table base location at 0x08000000 */
    NVIC_SetVectorTable(NVIC_VectTab_FLASH, 0x0);

    NVIC_PriorityGroupConfig(NVIC_PriorityGroup_4);

    init_led(LED1);
    init_led(LED2);

    init_button();

    enable_button();
    enable_timer(TIM2, RCC_APB1Periph_TIM2, 3200, 2000);

    enable_interrupt(TIM2_IRQn, 7, 0);
    enable_interrupt(USER_BUTTON_EXTI_IRQn, 7, 1);

    led_on(LED1);

    while (1) {}
}

/*******************************************************************************
 ** Function Name : init_led
 ** Parameters    : led - What led to initialize.
 ** Returns       : none.
 **
 ** Description   : Initializes a led.
 ******************************************************************************/
void init_led(led_t led)
{
    GPIO_InitTypeDef init;
    /* Need to enable the gpio port E clock for output. */
    RCC_AHB1PeriphClockCmd(LED_RCC_Periph_PORT, ENABLE);
    /* What pin to configure. */
    init.GPIO_Pin = led_pins[led];
    init.GPIO_Mode = GPIO_Mode_OUT;
    init.GPIO_OType = GPIO_OType_PP;
    init.GPIO_PuPd = GPIO_PuPd_NOPULL;
    init.GPIO_Speed = GPIO_Speed_50MHz;
    /* Initialize a specific pin on gpio port E. */
    GPIO_Init(LED_PORT, &init);

    /* Turn led pin to low. We don't want the pin to be on after
       init. */
    LED_PORT->BSRRL = led_pins[led];
}

/*******************************************************************************
 ** Function Name : init_button
 ** Parameters    : none.
 ** Returns       : none.
 **
 ** Description   : Initializes button pin.
 ******************************************************************************/
void init_button()
{
    /* Initialize the button, almost the same as with the leds
     * except we set it to input mode. */
	GPIO_InitTypeDef init;
	RCC_AHB1PeriphClockCmd(BUTTON_RCC_Periph_PORT, ENABLE);
	init.GPIO_Pin = USER_BUTTON_PIN;
	init.GPIO_Mode = GPIO_Mode_IN;
	init.GPIO_PuPd = GPIO_PuPd_DOWN;

    GPIO_Init(USER_BUTTON_PORT, &init);
}

/*******************************************************************************
 ** Function Name : enable_button
 ** Parameters    : none.
 ** Returns       : none.
 **
 ** Description   : Enables exti pin for the button.
 ******************************************************************************/
void enable_button()
{
	EXTI_InitTypeDef init;
	/* The button is connected to line 0 on the exti. */
	init.EXTI_Line = USER_BUTTON_EXTI_LINE;
	/* We want it to be an interrupt and not an event. */
	init.EXTI_Mode = EXTI_Mode_Interrupt;
	/* Trigger interrupt on rising edge. */
	init.EXTI_Trigger = EXTI_Trigger_Rising;
	init.EXTI_LineCmd = ENABLE;

	EXTI_Init(&init);

	/* We need to enable this clock for pin 0 on gpio port A to
	   get interrupt when the edge changes, otherwise you'll get interrupts
	   all the time. */
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_SYSCFG, ENABLE);
    SYSCFG_EXTILineConfig(
            USER_BUTTON_EXTI_PORT_SOURCE,
            USER_BUTTON_EXTI_PIN_SOURCE);
}

/*******************************************************************************
 ** Function Name : enable_timer
 ** Parameters    : timer      - What timer to enable.
 **                 enable_reg - Enable register for the timer.
 **                 prescaler  - Prescaler.
 **                 period     - Period.
 ** Returns       : none.
 **
 ** Description   : Enables a timer with up counting mode with a user defined
 **                 prescaler and period.
 ******************************************************************************/
void enable_timer(TIM_TypeDef * timer,
                  uint32_t enable_reg,
                  uint16_t prescaler,
                  uint32_t period)
{
	TIM_TimeBaseInitTypeDef timer_init_struct;

	/* Enable peripheral clock for timer. */
	RCC_APB1PeriphClockCmd(enable_reg, ENABLE);
	RCC_APB1PeriphResetCmd(enable_reg, DISABLE);

	timer_init_struct.TIM_Prescaler = prescaler;
	/* Here we set counter mode to up. */
	timer_init_struct.TIM_CounterMode = TIM_CounterMode_Up;
	timer_init_struct.TIM_Period = period;
	timer_init_struct.TIM_ClockDivision = TIM_CKD_DIV1;
	TIM_TimeBaseInit(timer, &timer_init_struct);

	TIM_ClearITPendingBit(timer, TIM_FLAG_Update);
	TIM_ITConfig(timer, TIM_FLAG_Update, ENABLE);

	TIM_Cmd(timer, ENABLE);
}

/*******************************************************************************
 ** Function Name : enable_interrupt
 ** Parameters    : interrupt       - What interrupt to enable.
 **                 preemption_prio - Preemption priority.
 **                 sub_prio        - Sub priority.
 ** Returns       : none.
 **
 ** Description   : Enables a interrupt with a given priority.
 ******************************************************************************/
void enable_interrupt(IRQn_Type interrupt,
                      uint8_t preemption_prio,
                      uint8_t sub_prio)
{
	__disable_interrupt();

	NVIC_InitTypeDef interr;
	interr.NVIC_IRQChannel = interrupt;
	interr.NVIC_IRQChannelPreemptionPriority = preemption_prio;
	interr.NVIC_IRQChannelSubPriority = sub_prio;
	interr.NVIC_IRQChannelCmd = ENABLE;
	NVIC_Init(&interr);

	__enable_interrupt();
}

/*******************************************************************************
 ** Function Name : tim2_interrupt_handler
 ** Parameters    : none.
 ** Returns       : none.
 **
 ** Description   : Handles tim2 interrupts.
 ******************************************************************************/
void tim2_interrupt_handler()
{
    TIM_ClearITPendingBit(TIM2, TIM_FLAG_Update);
    led_toggle(LED1);
}

uint32_t led_speed[] = {2000, 1800, 1600, 1400, 1000, 800};
uint8_t led_speed_at = 0;
uint8_t led_speed_count = 6;

/*******************************************************************************
 ** Function Name : exti0_interrupt_handler
 ** Parameters    : none.
 ** Returns       : none.
 **
 ** Description   : Handles exti line 0 interrupt. It toggles LED2 and
 **                 changes speed for how fast LED1 toggels.
 ******************************************************************************/
void USER_button_interrupt_handler()
{
    if (EXTI_GetFlagStatus(USER_BUTTON_EXTI_LINE) == SET) {
        led_toggle(LED2);

        TIM_SetAutoreload(TIM2, led_speed[led_speed_at]);
        TIM_SetCounter(TIM2, 0);
        led_speed_at++;
        if (led_speed_at == led_speed_count) {
          led_speed_at = 0;
        }

        EXTI_ClearITPendingBit(USER_BUTTON_EXTI_LINE);
    }
}

/*******************************************************************************
 ** Function Name : led_on
 ** Parameters    : led - To operate on.
 ** Returns       : none.
 **
 ** Description   : Turns on a specified led.
 ******************************************************************************/
void led_on(led_t led)
{
    GPIOE->BSRRH = led_pins[led];
}

/*******************************************************************************
 ** Function Name : led_off
 ** Parameters    : led - To operate on.
 ** Returns       : none.
 **
 ** Description   : Turns off a specified led.
 ******************************************************************************/
void led_off(led_t led)
{
    GPIOE->BSRRL = led_pins[led];
}

/*******************************************************************************
 ** Function Name : led_toggle
 ** Parameters    : led - To operate on.
 ** Returns       : none.
 **
 ** Description   : Toggles a specified led.
 ******************************************************************************/
void led_toggle(led_t led)
{
    GPIOE->ODR ^= led_pins[led];
}
