import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.google.common.collect.ImmutableList;
import com.zarbosoft.checkjson.Valid;
import com.zarbosoft.coroutines.Cohelp;
import com.zarbosoft.coroutinescore.SuspendExecution;
import com.zarbosoft.coroutinescore.SuspendableRunnable;
import com.zarbosoft.gettus.Cogettus;
import com.zarbosoft.gettus.Gettus;
import com.zarbosoft.gettus.GettusBase;
import com.zarbosoft.microwebserver.*;
import com.zarbosoft.scheduledxnio.ScheduledXnioWorker;
import io.undertow.Undertow;
import io.undertow.util.HttpString;
import io.undertow.websockets.core.WebSocketChannel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.xnio.OptionMap;
import org.xnio.Options;

import java.nio.charset.StandardCharsets;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import static com.zarbosoft.microwebserver.WebServer.jackson;
import static com.zarbosoft.microwebserver.WebServer.websocketSend;
import static com.zarbosoft.rendaw.common.Common.uncheck;
import static io.undertow.util.Methods.POST;

public class Main {
	private static final String ENV_MICROMICRO_HOST = System.getenv("MICROMICRO_HOST");
	private static final String ENV_MICROMICRO_USER = System.getenv("MICROMICRO_USER");
	private static final String ENV_MICROMICRO_TOKEN = System.getenv("MICROMICRO_TOKEN");
	private static final String ENV_MICROMICRO_SECRET = System.getenv("MICROMICRO_SECRET");

	private static final Logger logger = LoggerFactory.getLogger("main");
	private static AtomicLong rate = new AtomicLong(100);
	private static ScheduledXnioWorker worker;
	private static ConcurrentHashMap<String, NotifyInfo> notify = new ConcurrentHashMap<>();
	private static Map<String, GameInfo> games =
			uncheck(() -> jackson.readValue(Main.class.getClassLoader().getResourceAsStream("games.json"),
					jackson.getTypeFactory().constructParametricType(Map.class, String.class, GameInfo.class)
			));

	public static class GameInfo {
		@JsonProperty
		public String name;

		@JsonProperty
		public long price;

		@JsonProperty
		public String wallet;
	}

	public static class NotifyInfo {
		public final WebSocketChannel channel;
		public final GameInfo game;

		public NotifyInfo(WebSocketChannel channel, GameInfo game) {
			this.channel = channel;
			this.game = game;
		}
	}

	public static void main(final String[] args) {
		final int maxUserThreads = 16;
		final int maxInternalThreads = 4;
		worker = uncheck(() -> ScheduledXnioWorker.createWorker(OptionMap
				.builder()
				.set(/* All user callbacks. */ Options.WORKER_TASK_MAX_THREADS, maxUserThreads)
				.set(/* Undertow (?) and xnio internal work. */ Options.WORKER_IO_THREADS, maxInternalThreads)
				.getMap()));
		try {
			Cohelp.block(() -> {
				mainAsync(worker);
			});
		} catch (final Throwable e) {
			worker.shutdown();
			try {
				worker.awaitTermination();
			} catch (final InterruptedException e1) {
			}
			throw e;
		}
	}

	public static void mainAsync(final ScheduledXnioWorker worker) throws SuspendExecution {
		SuspendableRunnable updatePrices = () -> {
			rate.set(new Cogettus(worker.inner, Gettus.formatURI("https://api.%s/v1/rates", ENV_MICROMICRO_HOST))
					.send()
					.body()
					.json()
					.get("usd")
					.asLong());
			logger.info(String.format("Updated USD rate: %s", rate.get()));
		};
		updatePrices.run();
		Cohelp.repeat(worker, 24, ChronoUnit.HOURS, updatePrices);

		final Undertow outward = new WebServer(null, worker, "outward", ImmutableList.of())
				.route(RequestHealth.class, "/health")
				.route(RequestAddress.class, "/address", true)
				.route(RequestCallback.class, String.format("/callback/%s", ENV_MICROMICRO_SECRET))
				.start(worker.inner, 8080, "0.0.0.0");
		outward.start();

		Runtime.getRuntime().addShutdownHook(new Thread() {
			@Override
			public void run() {
				outward.stop();
				worker.shutdown();
				while (true)
					try {
						worker.awaitTermination();
						break;
					} catch (final InterruptedException e) {
					}
			}
		});
	}

	public static class RequestHealth extends Request<Main> {
		static ResponseRaw resp = new ResponseRaw(null, "salut".getBytes(StandardCharsets.UTF_8));

		@Override
		public Response process(
				final HttpString method, final Main context, final WebSocketChannel websocket
		) throws SuspendExecution {
			return resp;
		}
	}

	public static class RequestAddress extends Request<Main> {
		@JsonProperty
		@Valid(min = Valid.Limit.INCLUSIVE, minValue = 1)
		public String game;

		@Override
		public Response process(
				final HttpString method, final Main context, final WebSocketChannel websocket
		) throws SuspendExecution {
			GameInfo gameInfo = games.get(game);
			if (gameInfo == null)
				throw ErrorRequest.format("Unknown game %s", game);
			JsonNode addr = new Cogettus(context.worker.inner,
					Gettus.formatURI("https://api.%s/v1/new_in", ENV_MICROMICRO_HOST)
			)
					.method(POST)
					.bodyJson(b -> {
						b.writeStartObject();
						b.writeStringField("username", ENV_MICROMICRO_USER);
						b.writeStringField("token", ENV_MICROMICRO_TOKEN);
						b.writeStringField("tos", "latest");
						b.writeBooleanField("slow", false);
						b.writeBooleanField("single_use", true);
						b.writeStringField("receiver_message", "");
						b.writeStringField("sender_message", String.format("1 token for %s", gameInfo.name));
						b.writeNumberField("amount", context.rate.get() * gameInfo.price);
						b.writeEndObject();
					})
					.send()
					.body()
					.json();
			if (addr.has("error")) {
				logger.error(String.format("Address creation error: %s", addr.get("error")));
				throw ErrorRequest.format("Internal error");
			}
			String addrId = addr.get("id").asText();
			notify.put(addrId, new NotifyInfo(websocket, gameInfo));
			return new ResponseRaw(null,
					String
							.format("{\"address\":\"https://%s/app/#in/%s\"}", ENV_MICROMICRO_HOST, addrId)
							.getBytes(StandardCharsets.UTF_8)
			);
		}
	}

	public static class RequestCallback extends RequestFreeJson<Main> {
		@Override
		public Response process(
				final HttpString method, final Main context, final WebSocketChannel _
		) throws SuspendExecution {
			do {
				if (data.has("testing"))
					break;
				String id = data.get("id").asText();
				NotifyInfo notifyInfo = notify.get(id);
				if (notifyInfo == null) {
					logger.error(String.format("Unknown payment address %s", id));
					break;
				}
				notify.remove(id);
				Cohelp.submit(worker.inner, () -> {
					websocketSend(worker.inner, notifyInfo.channel, ResponseEmpty.instance);
					uncheck(() -> notifyInfo.channel.sendClose());
				});
				Cohelp.submit(worker.inner, () -> {
					logger.info(
							"Made payment: %s",
							new Cogettus(
									worker.inner,
									GettusBase.formatURI("https://api.%s/v1/send", ENV_MICROMICRO_HOST)
							).bodyJson(b -> {
								b.writeStartObject();
								b.writeStringField("username", ENV_MICROMICRO_USER);
								b.writeStringField("token", ENV_MICROMICRO_TOKEN);
								b.writeStringField("tos", "latest");
								b.writeStringField("dest", notifyInfo.game.wallet);
								b.writeNumberField("amount", data.get("amount").asLong());
								b.writeStringField("sender_message", "Forward " + notifyInfo.game.name);
								b.writeEndObject();
							}).send().body().check().text()
					);
				});
			} while (false);
			return ResponseEmpty.instance;
		}
	}
}