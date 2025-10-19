import time
import pyautogui
import random

time.sleep(2)
while True:
    pyautogui.press("tab", 3)
    pyautogui.press("down", int(random.random()*5)+1)
    pyautogui.press("tab")
    pyautogui.press("down", int(random.random()*6)+1)
    pyautogui.press("tab")
    pyautogui.press("down", int(random.random()*6)+1)
    pyautogui.press("tab", 2)
    pyautogui.press("down", 2)
    pyautogui.press("tab")
    pyautogui.press("down", 2)
    pyautogui.press("tab")
    pyautogui.press("down", 2)
    pyautogui.press("tab")
    pyautogui.press("down", 2)
    pyautogui.press("tab", 2)
    pyautogui.press("down", 4)
    pyautogui.press("tab")
    pyautogui.press("enter")
    time.sleep(.3)
    pyautogui.press("tab")
    pyautogui.press("enter")