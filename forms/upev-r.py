import time
import pyautogui
import random

time.sleep(2)

a=5
while True:
    pyautogui.press("tab", 3)
    pyautogui.press("enter")
    pyautogui.press("down",a)
    pyautogui.press("enter")
    pyautogui.press("tab")
    pyautogui.press("down",5)
    time.sleep(.3)
    pyautogui.press("tab",2)
    pyautogui.press("down",4)
    pyautogui.press("tab")
    pyautogui.press("down",2)
    pyautogui.press("tab",2)
    pyautogui.press("enter")
    time.sleep(2)
    # click 93 101
    # pyautogui.hotkey("command", "r", interval=0.25)
    pyautogui.click(93,101)
    
    time.sleep(1)