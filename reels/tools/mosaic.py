"""사진 속 인물 얼굴 모자이크.

이 OpenCV 빌드에는 얼굴 자동 감지가 없을 수 있고, 뒷모습·옆모습은 감지도 잘 안 되므로
'좌표 격자 미리보기 → 눈으로 머리 위치 확인 → 박스 지정 → 결과 눈으로 재확인' 순서로 한다.

1) 격자 미리보기:  python reels/tools/mosaic.py grid <원본이미지> <미리보기.jpg>
   → 50px 격자 + 100px마다 좌표 숫자가 찍힌 이미지. Read 도구로 열어 모든 사람의 머리 위치를 읽는다.
2) 적용:          python reels/tools/mosaic.py apply <원본이미지> <저장.jpg> '<boxes JSON>' [crop JSON]
   boxes: [[x,y,w,h], ...]  (원본 픽셀 좌표, 머리 전체를 넉넉히 감싸게)
   crop : [x1,y1,x2,y2]     (테두리 프레임 등을 잘라낼 때, 모자이크 후 적용)
3) 저장 결과를 Read 도구로 열어 **모든 얼굴**이 가려졌는지 확인. 하나라도 보이면 박스를 늘려 다시.

규칙: 원본(얼굴 노출)은 절대 레포에 넣지 않는다. 결과만 assets/images/sevenstars/에 저장.
필요: python에서 import cv2, numpy (예: pip install opencv-python-headless numpy)
"""
import json
import sys

import cv2


def grid(src, out):
    img = cv2.imread(src)
    h, w = img.shape[:2]
    vis = img.copy()
    for x in range(0, w, 50):
        cv2.line(vis, (x, 0), (x, h), (255, 0, 255) if x % 100 == 0 else (120, 0, 120), 1)
        if x % 100 == 0:
            cv2.putText(vis, str(x), (x + 2, 16), 0, 0.5, (0, 255, 255), 1)
    for y in range(0, h, 50):
        cv2.line(vis, (0, y), (w, y), (255, 0, 255) if y % 100 == 0 else (120, 0, 120), 1)
        if y % 100 == 0:
            cv2.putText(vis, str(y), (2, y - 3), 0, 0.5, (0, 255, 255), 1)
    cv2.imwrite(out, vis)
    print(f'{out}  ({w}x{h})')


def apply(src, out, boxes, crop=None):
    img = cv2.imread(src)
    H, W = img.shape[:2]
    for x, y, w, h in boxes:
        x2, y2 = min(W, x + w), min(H, y + h)
        x, y = max(0, x), max(0, y)
        blk = max(6, max(w, h) // 8)  # 얼굴이 클수록 블록도 크게
        roi = img[y:y2, x:x2]
        small = cv2.resize(roi, (max(1, (x2 - x) // blk), max(1, (y2 - y) // blk)), interpolation=cv2.INTER_AREA)
        img[y:y2, x:x2] = cv2.resize(small, (x2 - x, y2 - y), interpolation=cv2.INTER_NEAREST)
    if crop:
        x1, y1, x2, y2 = crop
        img = img[y1:y2, x1:x2]
    cv2.imwrite(out, img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(f'{out}  ({img.shape[1]}x{img.shape[0]}, {len(boxes)} boxes)')


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'grid':
        grid(sys.argv[2], sys.argv[3])
    elif mode == 'apply':
        apply(sys.argv[2], sys.argv[3], json.loads(sys.argv[4]), json.loads(sys.argv[5]) if len(sys.argv) > 5 else None)
    else:
        sys.exit(__doc__)
