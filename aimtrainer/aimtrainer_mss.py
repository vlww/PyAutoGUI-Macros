import pyautogui
import time
import mss

pyautogui.PAUSE = 0
pyautogui.FAILSAFE = True

REGION_X1, REGION_Y1 = 40, 230
REGION_X2, REGION_Y2 = 920, 700
REGION_WIDTH = REGION_X2 - REGION_X1
REGION_HEIGHT = REGION_Y2 - REGION_Y1

TARGET_SIZE = 70

TARGET_COLOR = (163, 194, 229)

COLOR_TOLERANCE = 20

SCAN_STEP = 40

REFINE_STEP = 10

POST_CLICK_DELAY = 0.00


def color_matches(pixel, target, tolerance):
    return all(abs(pixel[i] - target[i]) <= tolerance for i in range(3))


def find_target_center(pixels, width, height):
    rough_point = None

    for y in range(0, height, SCAN_STEP):
        for x in range(0, width, SCAN_STEP):
            if color_matches(pixels[x, y], TARGET_COLOR, COLOR_TOLERANCE):
                rough_point = (x, y)
                break
        if rough_point:
            break

    if rough_point is None:
        return None

    rx, ry = rough_point

    x_start = max(0, rx - TARGET_SIZE)
    x_end = min(width, rx + TARGET_SIZE)
    y_start = max(0, ry - TARGET_SIZE)
    y_end = min(height, ry + TARGET_SIZE)

    points = []
    for y in range(y_start, y_end, REFINE_STEP):
        for x in range(x_start, x_end, REFINE_STEP):
            if color_matches(pixels[x, y], TARGET_COLOR, COLOR_TOLERANCE):
                points.append((x, y))

    if not points:
        points = [rough_point]

    avg_x = sum(p[0] for p in points) / len(points)
    avg_y = sum(p[1] for p in points) / len(points)
    return avg_x, avg_y


def main():
    time.sleep(1)
    click_count = 0

    with mss.mss() as sct:
        monitor = {
            "left": REGION_X1,
            "top": REGION_Y1,
            "width": REGION_WIDTH,
            "height": REGION_HEIGHT,
        }

        try:
            while click_count < 30:
                shot = sct.grab(monitor)
                width, height = shot.size
                raw = shot.bgra  

                def pixel_at(x, y, _raw=raw, _w=width):
                    idx = (y * _w + x) * 4
                    b, g, r = _raw[idx], _raw[idx + 1], _raw[idx + 2]
                    return (r, g, b)

                class PixelAccess:
                    def __getitem__(self, xy):
                        return pixel_at(xy[0], xy[1])

                center = find_target_center(PixelAccess(), width, height)

                if center:
                    tx = REGION_X1 + center[0]
                    ty = REGION_Y1 + center[1]
                    pyautogui.click(tx, ty)
                    click_count += 1
                    print(f"Click {click_count}/30")
                    time.sleep(POST_CLICK_DELAY)

            print("Done - 30 clicks reached.")

        except KeyboardInterrupt:
            print("\nStopped by user.")


if __name__ == "__main__":
    main()