import pyautogui
import time
"""
time.sleep(2)
print(pyautogui.position())
"""
time.sleep(2)
bal = 250000000
while True:
    pyautogui.click(700, 794)
    pyautogui.typewrite("/gamble")
    time.sleep(.1)
    pyautogui.press("enter")
    time.sleep(.05)
    pyautogui.press("enter")
    time.sleep(2.5)
    pyautogui.click(469, 714)
    time.sleep(.1)
    pyautogui.click(475, 486)
    time.sleep(3)
    pyautogui.click(465, 697)
    time.sleep(3)
    pyautogui.press("backspace", presses=40)
    pyautogui.typewrite(f"{bal:.0f}")
    bal *= 1.03
    time.sleep(.1)
    pyautogui.click(662,590)
    time.sleep(2)