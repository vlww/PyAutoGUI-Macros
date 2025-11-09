import time
import pyautogui
import random

time.sleep(2)

a=1
while True:
    pyautogui.press("tab", 3)
    pyautogui.press("enter")
    pyautogui.press("down",a)
    a+=1
    if a>51:
        a=1
    pyautogui.press("enter")
    pyautogui.press("tab")
    # 20 or 28
    pyautogui.press("down",5)
    pyautogui.press("tab")
    pyautogui.press("down",4)
    pyautogui.press("tab")
    pyautogui.press("down",2)