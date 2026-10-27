$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$outputFolder=Join-Path $PSScriptRoot '../images/share'
New-Item -ItemType Directory -Path $outputFolder -Force | Out-Null
foreach($kind in @('article','summary')){
 $bitmap=[System.Drawing.Bitmap]::new(1200,630);$graphics=[System.Drawing.Graphics]::FromImage($bitmap)
 $graphics.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $graphics.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
 $dark=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#252525'));$muted=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#626976'))
 $gold=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#ffbf00'));$white=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
 $pen=[System.Drawing.Pen]::new($dark.Color,7);$brand=[System.Drawing.Font]::new('Segoe UI',29,[System.Drawing.FontStyle]::Bold);$heading=[System.Drawing.Font]::new('Segoe UI',62,[System.Drawing.FontStyle]::Bold);$body=[System.Drawing.Font]::new('Segoe UI',25);$small=[System.Drawing.Font]::new('Segoe UI',19)
 try{
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#f8f7f2'));$graphics.FillRectangle($dark,0,0,1200,9)
  $graphics.DrawString('LIGHTCITY',$brand,$dark,62,48);$graphics.DrawString('RESOURCES',$small,$muted,924,61);$graphics.FillRectangle($gold,65,212,76,7)
  $label=if($kind -eq 'article'){'ARTICLES'}else{'SUMMARIES'};$caption=if($kind -eq 'article'){'Read. Reflect. Grow.'}else{'Key points. Clear reminders.'}
  $graphics.DrawString($label,$heading,$dark,56,245);$graphics.DrawString($caption,$body,$muted,64,350);$graphics.FillEllipse($gold,823,188,264,264)
  if($kind -eq 'article'){$graphics.DrawRectangle($pen,893,231,124,168);foreach($y in @(273,302,331,360)){$graphics.DrawLine($pen,916,$y,994,$y)}}else{$graphics.DrawRectangle($pen,859,251,94,136);$graphics.DrawRectangle($pen,953,251,94,136);foreach($y in @(278,307)){$graphics.DrawLine($pen,881,$y,931,$y);$graphics.DrawLine($pen,976,$y,1025,$y)};$graphics.DrawLine($pen,953,387,953,402)}
  $graphics.FillRectangle($dark,0,521,1200,109);$graphics.DrawString('Teaching Fellowship',$body,$white,64,552);$graphics.DrawString('lightcityfellowship.com',$small,$gold,834,560)
  $bitmap.Save((Join-Path $outputFolder ($kind+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
 }finally{$graphics.Dispose();$bitmap.Dispose();$dark.Dispose();$muted.Dispose();$gold.Dispose();$white.Dispose();$pen.Dispose();$brand.Dispose();$heading.Dispose();$body.Dispose();$small.Dispose()}
}
