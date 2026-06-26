import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { getSystemImageUrl } from '../lib/supabaseClient';

interface QRCodeRendererProps {
  value: string;
  size?: number;
}

export const QRCodeRenderer: React.FC<QRCodeRendererProps> = ({ value, size = 120 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      
      const drawFallbackShield = (canvasObj: HTMLCanvasElement) => {
        QRCode.toCanvas(
          canvasObj,
          value,
          {
            width: size,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: {
              dark: '#0c1445', // Vendza brand charcoal dark
              light: '#ffffff'
            }
          },
          (error) => {
            if (error) return;
            const ctx = canvasObj.getContext('2d');
            if (!ctx) return;

            const finalWidth = canvasObj.width;
            const finalHeight = canvasObj.height;
            const logoSize = finalWidth * 0.24; // 24% is the golden ratio for QR correction
            const x = (finalWidth - logoSize) / 2;
            const y = (finalHeight - logoSize) / 2;

            // White container background card
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(x - 3, y - 3, logoSize + 6, logoSize + 6, 4);
            } else {
              ctx.rect(x - 3, y - 3, logoSize + 6, logoSize + 6);
            }
            ctx.fill();

            // Vector shield shape
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#0284c7'; // Sky Blue border
            ctx.fillStyle = '#0c1445'; // Dark blue interior
            ctx.beginPath();
            ctx.moveTo(x + logoSize / 2, y + 2);
            ctx.lineTo(x + logoSize - 2, y + 4);
            ctx.lineTo(x + logoSize - 2, y + logoSize / 2);
            ctx.quadraticCurveTo(x + logoSize - 2, y + logoSize - 2, x + logoSize / 2, y + logoSize - 1);
            ctx.quadraticCurveTo(x + 2, y + logoSize - 2, x + 2, y + logoSize / 2);
            ctx.lineTo(x + 2, y + 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Draw a shiny checkmark in the shield
            ctx.strokeStyle = '#38bdf8'; // Sky-400
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x + logoSize * 0.35, y + logoSize * 0.5);
            ctx.lineTo(x + logoSize * 0.48, y + logoSize * 0.65);
            ctx.lineTo(x + logoSize * 0.68, y + logoSize * 0.35);
            ctx.stroke();
          }
        );
      };

      logo.onload = () => {
        const canvasObj = canvasRef.current;
        if (!canvasObj) return;

        QRCode.toCanvas(
          canvasObj,
          value,
          {
            width: size,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: {
              dark: '#0c1445',
              light: '#ffffff'
            }
          },
          (error) => {
            if (error) {
              drawFallbackShield(canvasObj);
              return;
            }

            const ctx = canvasObj.getContext('2d');
            if (!ctx) return;

            const finalWidth = canvasObj.width;
            const finalHeight = canvasObj.height;
            const logoSize = finalWidth * 0.24;
            const x = (finalWidth - logoSize) / 2;
            const y = (finalHeight - logoSize) / 2;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(x - 3, y - 3, logoSize + 6, logoSize + 6, 4);
            } else {
              ctx.rect(x - 3, y - 3, logoSize + 6, logoSize + 6);
            }
            ctx.fill();

            try {
              ctx.drawImage(logo, x, y, logoSize, logoSize);
            } catch (e) {
              // Draw shield vector if drawImage errors out (e.g. cross origin tainted canvas block)
              drawFallbackShield(canvasObj);
            }
          }
        );
      };

      logo.onerror = () => {
        const canvasObj = canvasRef.current;
        if (!canvasObj) return;
        drawFallbackShield(canvasObj);
      };

      logo.src = getSystemImageUrl('vendza_qr_logo.png', '/images/vendza_qr_logo.png');
    }
  }, [value, size]);

  return (
    <canvas 
      ref={canvasRef} 
      className="max-w-full rounded-lg bg-white " 
      style={{ width: size, height: size }} 
    />
  );
};
