// ../../../carlos Site/netlify/functions/bunny-get.js
exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: ""
    };
  }
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }
  try {
    const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
    const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || "549524";
    const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || "vz-08277cf8-e40.b-cdn.net";
    if (!BUNNY_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "BUNNY_API_KEY non configur\xE9e"
        })
      };
    }
    const videoId = event.queryStringParameters?.videoId;
    const libraryId = event.queryStringParameters?.libraryId || BUNNY_LIBRARY_ID;
    if (!videoId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "videoId est requis dans les query parameters"
        })
      };
    }
    if (!libraryId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "libraryId est requis (query param ou BUNNY_LIBRARY_ID)"
        })
      };
    }
    const videoUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`;
    const response = await fetch(videoUrl, {
      headers: {
        "AccessKey": BUNNY_API_KEY
      }
    });
    if (!response.ok) {
      if (response.status === 404) {
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            error: "Vid\xE9o non trouv\xE9e"
          })
        };
      }
      let errorText = "Erreur inconnue";
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = `Erreur HTTP ${response.status}`;
      }
      throw new Error(`Erreur Bunny.net: ${response.status} - ${errorText}`);
    }
    let videoData;
    try {
      videoData = await response.json();
    } catch (parseError) {
      throw new Error(`Erreur lors du parsing de la r\xE9ponse JSON: ${parseError.message || "Format invalide"}`);
    }
    const cdnHostname = BUNNY_CDN_HOSTNAME;
    const streamingUrl = `https://${cdnHostname}/${videoId}/play_480p.mp4`;
    if (!videoData || typeof videoData !== "object") {
      throw new Error("R\xE9ponse invalide de l'API Bunny.net: donn\xE9es vid\xE9o manquantes");
    }
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: true,
        video: {
          id: videoData.guid || videoData.id || videoId,
          title: videoData.title || null,
          status: videoData.status || null,
          thumbnailFileName: videoData.thumbnailFileName || null,
          thumbnailUrl: videoData.thumbnailFileName ? `https://${cdnHostname}/${videoId}/${videoData.thumbnailFileName}` : null,
          streamingUrl,
          createdAt: videoData.dateCreated || null,
          views: videoData.views || 0,
          duration: videoData.length || 0,
          size: videoData.storageSize || 0,
          libraryId
        }
      })
    };
  } catch (error) {
    console.error("Erreur r\xE9cup\xE9ration vid\xE9o Bunny.net:", error);
    let errorMessage = "Erreur lors de la r\xE9cup\xE9ration de la vid\xE9o";
    if (error) {
      if (typeof error === "string") {
        errorMessage = error;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.toString && typeof error.toString === "function") {
        errorMessage = error.toString();
      }
    }
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: errorMessage
      })
    };
  }
};
//# sourceMappingURL=bunny-get.js.map
