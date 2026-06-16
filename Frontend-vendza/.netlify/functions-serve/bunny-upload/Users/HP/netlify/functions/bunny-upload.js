// ../../../carlos Site/netlify/functions/bunny-upload.js
exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }
  try {
    const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
    const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || "549524";
    const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "";
    const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || "vz-08277cf8-e40.b-cdn.net";
    if (!BUNNY_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "BUNNY_API_KEY non configur\xE9e dans les variables d'environnement Netlify"
        })
      };
    }
    const body = JSON.parse(event.body || "{}");
    const { videoFile, fileName, libraryId } = body;
    if (!videoFile || !fileName) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "videoFile et fileName sont requis"
        })
      };
    }
    const targetLibraryId = libraryId || BUNNY_LIBRARY_ID;
    if (!targetLibraryId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "libraryId est requis (fourni dans le body ou dans BUNNY_LIBRARY_ID)"
        })
      };
    }
    let videoBuffer;
    if (typeof videoFile === "string" && videoFile.startsWith("data:")) {
      const base64Data = videoFile.split(",")[1];
      videoBuffer = Buffer.from(base64Data, "base64");
    } else if (typeof videoFile === "string") {
      videoBuffer = Buffer.from(videoFile, "base64");
    } else {
      videoBuffer = videoFile;
    }
    const uploadUrl = `https://video.bunnycdn.com/library/${targetLibraryId}/videos`;
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "AccessKey": BUNNY_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: fileName
      })
    });
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Erreur Bunny.net: ${uploadResponse.status} - ${errorText}`);
    }
    const videoData = await uploadResponse.json();
    const videoId = videoData.guid || videoData.id;
    if (!videoId) {
      throw new Error("Impossible de r\xE9cup\xE9rer l'ID de la vid\xE9o cr\xE9\xE9e");
    }
    const fileUploadUrl = `https://video.bunnycdn.com/library/${targetLibraryId}/videos/${videoId}`;
    const fileUploadResponse = await fetch(fileUploadUrl, {
      method: "PUT",
      headers: {
        "AccessKey": BUNNY_API_KEY,
        "Content-Type": "application/octet-stream"
      },
      body: videoBuffer
    });
    if (!fileUploadResponse.ok) {
      const errorText = await fileUploadResponse.text();
      throw new Error(`Erreur upload fichier: ${fileUploadResponse.status} - ${errorText}`);
    }
    const videoInfoUrl = `https://video.bunnycdn.com/library/${targetLibraryId}/videos/${videoId}`;
    const videoInfoResponse = await fetch(videoInfoUrl, {
      headers: {
        "AccessKey": BUNNY_API_KEY
      }
    });
    const videoInfo = await videoInfoResponse.json();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({
        success: true,
        video: {
          id: videoId,
          title: videoInfo.title || fileName,
          videoLibraryId: targetLibraryId,
          status: videoInfo.status,
          thumbnailFileName: videoInfo.thumbnailFileName,
          createdAt: videoInfo.dateCreated,
          views: videoInfo.views,
          duration: videoInfo.length
        }
      })
    };
  } catch (error) {
    console.error("Erreur upload Bunny.net:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: error.message || "Erreur lors de l'upload de la vid\xE9o"
      })
    };
  }
};
//# sourceMappingURL=bunny-upload.js.map
