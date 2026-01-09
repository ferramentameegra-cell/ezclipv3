import { exec } from 'child_process';

export const getYouTubeInfo = (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL não informada' });
    }

    const cmd = `yt-dlp --dump-json --no-warnings --no-playlist "${url}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 20 }, (err, stdout) => {
      if (err) {
        console.error('[INFO ERROR]', err);
        return res.status(500).json({ error: 'Falha ao obter info do vídeo' });
      }

      try {
        const info = JSON.parse(stdout);

        return res.json({
          success: true,
          title: info.title,
          duration: info.duration,
          thumbnail: info.thumbnail,
          author: info.uploader
        });
      } catch (parseErr) {
        console.error('[INFO PARSE ERROR]', parseErr);
        return res.status(500).json({ error: 'Erro ao processar metadata' });
      }
    });
  } catch (error) {
    console.error('[INFO FATAL]', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
